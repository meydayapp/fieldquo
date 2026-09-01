// lib/analytics/kpis.js
//
// One screen a contractor has never had: the numbers that decide whether the
// business is healthy, in one place, for one period.
//
// ══ This file invents nothing new ═══════════════════════════════════════════
//
// Every hard number below already has a builder that computes it correctly —
// buildWinLoss, buildReceivables, buildEstimateAccuracy, actualJobCost,
// labourUtilisation. This file's whole job is to CALL them, add the four or
// five figures that genuinely have no home yet (average job value, backlog in
// weeks, the margin roll-up, revenue per employee), and refuse to print
// anything none of them can support. It is deliberately thin: a second
// implementation of win rate here would be the copy that drifts from
// lib/analytics/winLoss.js the first time somebody fixes a bug in one and not
// the other (AGENTS.md failure class 4).
//
// ══ Pure — DB reads live in the route ═══════════════════════════════════════
//
// No `@/lib/db` import anywhere in this file. Every row a KPI needs arrives as
// an argument, shaped the way the route already shapes it for the builders
// this file calls. That is what lets scripts/check-kpis.mjs execute every
// branch — including "no data at all" and "one job, no rates, no overhead" —
// without a database, the same discipline winLoss.js and estimateAccuracy.js
// already keep.
//
// ══ Every KPI returns the same envelope ═════════════════════════════════════
//
//   { value, sampleSize, incomplete, reason }
//
//   value       the number, or null. NEVER 0 standing in for "unknown" — a
//               company with a real zero (no backlog, nothing overdue) gets a
//               real 0, and a company with no evidence gets null. Those are
//               different sentences and this file does not let them collapse
//               into the same digit (AGENTS.md failure class 5).
//   sampleSize  how many rows the value is drawn from, printed even when value
//               is null — "3 of 3 ran over" is honest at any n; a rate is not.
//   incomplete  true when the number is real but KNOWABLY short — unrated
//               hours, hours still awaiting approval, materials tracked
//               outside job costing. The UI must show this beside the number,
//               never average it away.
//   reason      a closed vocabulary code (see REASONS below) explaining a
//               null, or null when the value stands on its own. Never English
//               here — the page translates a code, the way winLoss's `notes` do.
//
// ══ Three traps this file exists to catch ═══════════════════════════════════
//
// 1. MARGIN RESTS ON APPROVED HOURS AND LOGGED EXPENSES. A crew that logs time
//    badly shows a BETTER margin — the bias runs optimistic on exactly the
//    worst-run jobs. `incomplete` on grossMarginPct / netMarginPct /
//    labourCostPctOfRevenue is that flag, sourced from actualJobCost's own
//    `incomplete`, never averaged away.
//
// 2. THE MATERIALS BUY-LIST IS NEVER READ BY JOB COSTING. JobMaterial.actualCost
//    (ticked off in the field) is invisible to actualJobCost, which sums
//    Expense rows only. A company that uses the buy-list AS its bookkeeping —
//    real money, never re-entered as an Expense — shows near-$0 materials cost
//    on jobs it visibly bought for. detectMaterialsBuyListTrap() below catches
//    exactly that shape and, when it fires, the margin KPIs refuse to print a
//    number rather than report a fake one.
//
// 3. OVERHEAD PER JOB IS null, NOT 0, UNLESS ForecastSettings.jobsPerWeekCapacity
//    IS SET. lib/analytics/minimumPrice.js deliberately removed a 3-jobs/week
//    guess because it was a bug that priced every quote against a number
//    FieldQuo invented. `netMarginPct` inherits that refusal exactly: the
//    caller passes `overheadPerJob` straight from calculateMinimumPrice(), and
//    a null here makes netMarginPct null too, with its own reason code —
//    never a silent fall-back to the gross figure.
import { buildWinLoss } from "./winLoss";
import { buildReceivables, buildRevenueTrend } from "./receivables";
import { buildEstimateAccuracy, MIN_SAMPLE as ESTIMATE_ACCURACY_MIN_SAMPLE } from "./estimateAccuracy";
import { actualJobCost, compareJobCost } from "@/lib/costing/actualJobCost";
import { labourUtilisation } from "@/lib/costing/utilisation";
import { dayKey } from "@/lib/export/accountingExport";
import { safetyIncidentSummary, MIN_HOURS_FOR_RATE } from "./safety";

// ── Sample floors ────────────────────────────────────────────────────────
//
// Two floors, matched to the two kinds of claim this file makes, and neither
// is invented for this file — both restate a floor already argued for
// elsewhere so a reader who has seen one has seen both.
//
// RATE_FLOOR: for a PERCENTAGE. lib/analytics/winLoss.js's own argument: below
// ten decided outcomes, one of them flipping moves the rate by more than ten
// points, which is a bigger swing than anyone would act on. Win rate,
// lead-to-quote conversion and on-time completion are all "N of M hit a bar"
// questions and share the argument exactly.
export const RATE_FLOOR = 10;

// COUNT_FLOOR: for a MEDIAN or a SUM-OF-RATIOS over a set of jobs.
// lib/analytics/estimateAccuracy.js's own floor (MIN_SAMPLE = 5) and its own
// argument: the claim here is directional ("your jobs run at X% margin"), and
// at five jobs all landing the same side of a coin flip is already under 1-in-10.
// Average job value, gross/net margin and labour cost % of revenue all draw a
// central figure from a handful of jobs and share that argument.
export const COUNT_FLOOR = ESTIMATE_ACCURACY_MIN_SAMPLE;

// ── The materials-buy-list trap ─────────────────────────────────────────────
//
// If the buy-list total for a set of jobs is real money and the Expense total
// for the SAME jobs is a small fraction of it, the company is plainly
// bookkeeping through JobMaterial.actualCost and not through Expense — and
// every margin figure built from actualJobCost is therefore missing most of
// its materials cost. 10%: a company that buys the odd incidental through the
// buy-list and expenses everything else should not trip this; a company whose
// Expense total is a rounding error next to what it visibly bought should.
const MATERIALS_TRAP_EXPENSE_FRACTION = 0.1;
// Below this many dollars of buy-list spend, a mismatch is noise (a single
// ticked-off tube of caulk), not a bookkeeping pattern.
const MATERIALS_TRAP_MIN_BUYLIST = 200;

// Same defensive conversion lib/analytics/winLoss.js uses: a Prisma Decimal
// arrives as an object with toNumber(); a JSON round-trip makes it a string.
// This file takes rows straight off queries the route hasn't pre-converted
// (job.quote.acceptedTotal, JobMaterial.actualCost), so the plainer `Number(v)`
// receivables.js gets away with is not safe enough here.
const num = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n =
    typeof v === "object" && typeof v.toNumber === "function" ? v.toNumber() : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round1 = (v) => {
  const r = Math.round(num(v) * 10) / 10;
  return Number.isFinite(r) ? r : 0;
};
const round2 = (v) => {
  const r = Math.round(num(v) * 100) / 100;
  return Number.isFinite(r) ? r : 0;
};
const median = (values) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * Every `reason` code any KPI below can return, with the English sentence a
 * screen shows when it has no translation for the code — the same closed-
 * vocabulary pattern lib/analytics/estimateAccuracy.js's EXCLUSION_REASONS
 * uses, so a caller can render any KPI generically off `reason` alone rather
 * than needing a switch statement per metric.
 *
 * ── Six of these say how many, not just that ────────────────────────────────
 *
 * below_floor, none_decided_yet, no_quotes_sent, no_won_quotes and
 * no_leads_in_period carry a `{floor}` (and `below_floor` a `{sampleSize}` and
 * `{remaining}`) placeholder rather than a baked-in number. The count comes
 * from the `kpi()` envelope's own extra fields (see the call sites below,
 * every one of which sets `floor`/`remaining` off RATE_FLOOR or COUNT_FLOOR,
 * never off a typed digit) — so a contractor reads "how many more" instead of
 * a dash, and the number can never drift from the constant that actually
 * gates the metric. app/app/analytics/kpis/page.js's REASON_I18N_KEYS is what
 * substitutes the placeholders (and translates the sentence into French); a
 * reason code with no entry there just prints this English text as-is, which
 * is why none of the OTHER reasons below take a placeholder — a `{floor}` with
 * nothing to fill it would show up on screen literally.
 *
 * no_throughput_reference (backlog) deliberately carries no number: what it
 * needs is one completed, priced job this period, not a count to clear — see
 * buildBacklogWeeks.
 */
export const REASONS = {
  below_floor: "{sampleSize} of {floor} so far — {remaining} more and this becomes reliable.",
  none_decided_yet:
    "Nothing's been decided yet this period. Once {floor} quotes are marked won or lost, your win rate shows here.",
  no_quotes_sent:
    "Send quotes and get {floor} of them decided — won or lost — and your win rate shows here.",
  no_won_quotes: "Win {floor} quotes and your average job value shows here.",
  no_leads_in_period:
    "No leads yet this period. Once {floor} leads have come in, this shows what share turn into quotes.",
  no_throughput_reference:
    "There's a backlog, but no job with a priced quote was completed this period to measure a weekly pace against. Complete one and this fills in.",
  materials_tracked_outside_job_costing:
    "Materials on these jobs were ticked off the buy-list but never entered as an expense, so job costing cannot see what they actually cost.",
  no_completed_jobs: "No jobs were completed in this period.",
  no_priced_jobs: "No completed job in this period had both a revenue figure and a cost to compare.",
  overhead_unknown:
    "Set how many jobs a week you can take on in Settings → Overhead, and net margin can be worked out.",
  no_revenue_in_period: "No revenue was recorded against a completed job in this period.",
  no_active_workers: "There are no active team members to divide revenue across.",
  no_scheduled_jobs: "No completed job in this period had a visit scheduled to measure against.",
  no_scheduled_hours: "No active field worker has a guaranteed week set, so there is nothing to compare hours against.",
  no_invoices: "No invoices have ever been raised.",
  no_survey_responses:
    "No client has answered the satisfaction survey yet. Once {floor} have, this shows here.",
  not_enough_hours:
    "Fewer than {minHours} approved hours logged this period — not enough exposure yet for a rate that means anything. Keep logging hours and incidents; this fills in on its own.",
};

/**
 * The envelope every KPI returns. `extra` carries the figure's own detail.
 *
 * `reasonText` is the REASONS sentence for `reason`, attached here rather than
 * left for the page to look up — the same choice estimateAccuracy.js makes for
 * its EXCLUSION_REASONS (`statement: EXCLUSION_REASONS[reason] || reason`), so
 * a screen can render any KPI generically off `reasonText` without carrying
 * its own copy of this dictionary that could drift from this one.
 */
function kpi({ value = null, sampleSize = 0, incomplete = false, reason = null, ...extra }) {
  return {
    value,
    sampleSize,
    incomplete,
    reason,
    reasonText: reason ? REASONS[reason] || reason : null,
    ...extra,
  };
}

/**
 * A rate over (numerator, denominator), floored at RATE_FLOOR, envelope-
 * shaped. Both empty branches carry `floor: RATE_FLOOR` (and the below-floor
 * branch `remaining`, how many more before the rate is trusted) so the
 * REASONS sentence for whichever code the caller passes can say how many are
 * needed, not just that none are shown yet — see the header comment on
 * REASONS for why the number lives here rather than typed into a string.
 */
function rateKpi(numerator, denominator, { noneYetReason, belowFloorReason }) {
  if (denominator <= 0) {
    return kpi({ sampleSize: 0, reason: noneYetReason, floor: RATE_FLOOR });
  }
  if (denominator < RATE_FLOOR) {
    return kpi({
      sampleSize: denominator,
      reason: belowFloorReason,
      floor: RATE_FLOOR,
      remaining: RATE_FLOOR - denominator,
    });
  }
  return kpi({
    value: round1((numerator / denominator) * 100),
    sampleSize: denominator,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SALES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Win rate + average won-job value, off ONE call to buildWinLoss so the two
 * can never disagree about which quotes count. `quotes` and `undatedCount` are
 * shaped exactly as app/api/analytics/win-loss/route.js already shapes them —
 * the same SELECT, the same tier-group backfill.
 */
function buildSalesFromWinLoss({ from, to, quotes, undatedCount }) {
  const report = buildWinLoss({ from, to, quotes, undatedCount });

  const winRate = report.hasData
    ? report.winRate.value === null
      ? report.winRate.suppressed === "below_floor"
        ? kpi({
            sampleSize: report.winRate.n,
            reason: "below_floor",
            floor: RATE_FLOOR,
            remaining: RATE_FLOOR - report.winRate.n,
          })
        : kpi({ sampleSize: report.winRate.n, reason: "none_decided_yet", floor: RATE_FLOOR })
      : kpi({ value: round1(report.winRate.value * 100), sampleSize: report.winRate.n })
    : kpi({ sampleSize: 0, reason: "no_quotes_sent", floor: RATE_FLOOR });

  // Average value of a WON opportunity. Reuses winLoss's own "won" set — the
  // tier-group collapse and the acceptedTotal-over-total preference are both
  // inherited rather than re-derived, so this can never count a Good/Better/Best
  // trio as three deals or price a loss at the client's top offer.
  //
  // No quotes sent at all and quotes sent but none won both reduce to the SAME
  // next step — win COUNT_FLOOR of them — so both collapse to "no_won_quotes"
  // rather than the report.hasData split winRate makes above: winRate needs
  // DECIDED quotes (RATE_FLOOR), avgJobValue needs WON ones (COUNT_FLOOR), and
  // "no quotes exist yet" is truthfully just zero of either.
  const wonCount = report.value.won.counted;
  const avgJobValue =
    wonCount === 0
      ? kpi({ sampleSize: wonCount, reason: "no_won_quotes", floor: COUNT_FLOOR })
      : wonCount < COUNT_FLOOR
        ? kpi({
            sampleSize: wonCount,
            reason: "below_floor",
            floor: COUNT_FLOOR,
            remaining: COUNT_FLOOR - wonCount,
          })
        : kpi({
            value: round2(report.value.won.amount / wonCount),
            sampleSize: wonCount,
            // Some won opportunities had no readable total at all (junk data,
            // never a real deal) — named so the average is never quietly over
            // a smaller set than the count beside it implies.
            incomplete: report.value.won.unpriced > 0,
            unpricedExcluded: report.value.won.unpriced,
          });

  return { winRate, avgJobValue, winLossCounts: report.counts };
}

/** Leads created in the period, and what fraction became a quote. */
export function buildLeadToQuoteConversion({ leads = [] } = {}) {
  const total = Array.isArray(leads) ? leads.length : 0;
  // quoteId, not status === "converted": the schema itself calls quoteId "the
  // real link the old 'Start quote' button never made" — a lead whose status
  // lags behind (or was hand-set) still becomes a quote the moment quoteId is
  // written, and this is a report about quotes, not about a status column.
  const converted = (leads || []).filter((l) => l?.quoteId).length;
  return rateKpi(converted, total, {
    noneYetReason: "no_leads_in_period",
    belowFloorReason: "below_floor",
  });
}

/** A job's contracted value: the accepted total, or the quoted total. Null if there's no quote at all. */
function jobContractValue(job) {
  const q = job?.quote;
  if (!q) return null;
  const accepted = num(q.acceptedTotal);
  if (accepted > 0) return round2(accepted);
  const total = num(q.total);
  return total > 0 ? round2(total) : null;
}

/**
 * Backlog, in WEEKS of work booked ahead — not months. A residential trade
 * with 2–6 weeks on the board is healthy; the commercial-GC 8–12 MONTH
 * benchmark belongs to a different business and would libel this one.
 *
 * weeks = (value of accepted, not-yet-completed work) ÷ (a weekly throughput
 * rate, taken from the SAME period's completed work). Both sides use the same
 * `jobContractValue`, so a job's value can't quietly mean two different things
 * on the two sides of the division.
 *
 * @param {object[]} openJobs        status unscheduled/scheduled/in_progress,
 *                                    each `{ id, quote: {acceptedTotal,total,status} }`
 * @param {object[]} completedJobs   completed IN THIS PERIOD, same shape
 * @param {number}   weeksInPeriod   weeksBetween(from, to)
 */
export function buildBacklogWeeks({ openJobs = [], completedJobs = [], weeksInPeriod = 0 } = {}) {
  const priced = [];
  let noQuote = 0;
  let notAccepted = 0;
  for (const job of openJobs || []) {
    if (!job?.quote) {
      noQuote += 1;
      continue;
    }
    if (job.quote.status !== "accepted") {
      // A job sitting open whose quote was never marked accepted is real, but
      // its "value" would be inventing agreement nobody gave.
      notAccepted += 1;
      continue;
    }
    const value = jobContractValue(job);
    if (value === null) {
      noQuote += 1;
      continue;
    }
    priced.push(value);
  }
  const backlogValue = round2(priced.reduce((s, v) => s + v, 0));
  const backlogJobCount = priced.length;

  const throughputValues = (completedJobs || [])
    .map((j) => jobContractValue(j))
    .filter((v) => v !== null);
  const throughputTotal = round2(throughputValues.reduce((s, v) => s + v, 0));
  const throughputWeekly =
    weeksInPeriod > 0 && throughputValues.length > 0 ? throughputTotal / weeksInPeriod : null;

  const raw = {
    backlogValue,
    backlogJobCount,
    excludedNoQuote: noQuote,
    excludedNotAccepted: notAccepted,
    throughputTotal,
    throughputJobCount: throughputValues.length,
    weeksInPeriod: round1(weeksInPeriod),
  };

  // No open, accepted, priced work at all — a real zero, not an absence. The
  // company genuinely has nothing booked ahead right now.
  if (backlogJobCount === 0) {
    return kpi({ value: 0, sampleSize: 0, reason: null, raw });
  }
  // There IS a backlog, but nothing completed this period to measure a pace
  // against — weeks-of-work needs a rate, and there is none to divide by.
  // The dollar figure survives in `raw` so the screen isn't left with nothing.
  if (throughputWeekly === null || throughputWeekly <= 0) {
    return kpi({ sampleSize: backlogJobCount, reason: "no_throughput_reference", raw });
  }
  return kpi({
    value: round1(backlogValue / throughputWeekly),
    sampleSize: backlogJobCount,
    raw,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFIT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Whether this company is bookkeeping materials through the buy-list instead
 * of Expense — the trap described at the top of the file. Fires only on real
 * money at real scale; see the two constants above for why.
 */
export function detectMaterialsBuyListTrap({ buyListTotal = 0, expenseTotal = 0 } = {}) {
  const buyList = round2(buyListTotal);
  const expense = round2(expenseTotal);
  if (buyList < MATERIALS_TRAP_MIN_BUYLIST) {
    return { triggered: false, buyListTotal: buyList, expenseTotal: expense };
  }
  const triggered = expense <= buyList * MATERIALS_TRAP_EXPENSE_FRACTION;
  return { triggered, buyListTotal: buyList, expenseTotal: expense };
}

/**
 * Per-job actual cost and revenue, rolled up as a MEDIAN margin — a typical
 * job, not a money-weighted average that one enormous job could dominate. The
 * per-job marginPct itself is compareJobCost's own arithmetic
 * (profit / revenue), called once per job rather than restated here.
 *
 * @param {object[]} jobs  completed jobs, each:
 *   { id, revenue: number|null, expenses: [...], timeEntries: [...] }
 *   `revenue` is null when no non-draft, non-cancelled invoice was ever raised
 *   for the job — those jobs are excluded and counted, never priced at $0.
 * @param {number|null} overheadPerJob  from calculateMinimumPrice(); null when
 *   ForecastSettings.jobsPerWeekCapacity is unset. Net margin requires it; gross
 *   does not.
 * @param {object} materialsTrap  detectMaterialsBuyListTrap()'s result
 */
export function buildMarginRollup({ jobs = [], overheadPerJob = null, materialsTrap } = {}) {
  const rows = [];
  let noRevenue = 0;
  for (const job of jobs || []) {
    const revenue = job?.revenue;
    if (revenue === null || revenue === undefined || revenue <= 0) {
      noRevenue += 1;
      continue;
    }
    const actual = actualJobCost(job.expenses || [], job.timeEntries || []);
    // "Direct" cost: materials + labour, no overhead — the GROSS basis.
    const directCost = round2(actual.expenses.total + actual.labour.cost);
    rows.push({
      jobId: job.id,
      revenue: round2(revenue),
      directCost,
      labourCost: actual.labour.cost,
      incomplete: actual.incomplete,
    });
  }

  const sample = rows.length;
  const base = { jobsInRange: jobs.length, excludedNoRevenue: noRevenue, sample };

  // The trap overrides everything: a margin built on materials FieldQuo cannot
  // see is not a smaller margin, it is a wrong one, and printing it anyway is
  // exactly the "control that appears to work" AGENTS.md forbids.
  if (materialsTrap?.triggered) {
    const trapKpi = () =>
      kpi({
        sampleSize: sample,
        reason: "materials_tracked_outside_job_costing",
        raw: { ...base, materialsTrap },
      });
    return {
      grossMarginPct: trapKpi(),
      netMarginPct: trapKpi(),
      labourCostPctOfRevenue: buildLabourCostPct(rows, base),
      materialsTrap,
    };
  }

  if (sample === 0) {
    const empty = () =>
      kpi({ sampleSize: 0, reason: jobs.length === 0 ? "no_completed_jobs" : "no_priced_jobs", raw: base });
    return {
      grossMarginPct: empty(),
      netMarginPct: empty(),
      labourCostPctOfRevenue: empty(),
      materialsTrap,
    };
  }

  // compareJobCost's own marginPct: profit / revenue, called once per job
  // rather than the same division re-typed here.
  const grossPcts = rows.map(
    (r) => compareJobCost({ actualCost: r.directCost, revenue: r.revenue }).marginPct,
  );
  const incompleteCount = rows.filter((r) => r.incomplete).length;
  const grossMarginPct =
    sample < COUNT_FLOOR
      ? kpi({
          sampleSize: sample,
          reason: "below_floor",
          floor: COUNT_FLOOR,
          remaining: COUNT_FLOOR - sample,
          raw: base,
        })
      : kpi({
          value: round1(median(grossPcts)),
          sampleSize: sample,
          incomplete: incompleteCount > 0,
          incompleteJobs: incompleteCount,
          raw: base,
        });

  let netMarginPct;
  if (overheadPerJob === null || overheadPerJob === undefined) {
    // Never defaulted — see the header and lib/analytics/minimumPrice.js.
    netMarginPct = kpi({ sampleSize: sample, reason: "overhead_unknown", raw: base });
  } else {
    const netPcts = rows.map(
      (r) =>
        compareJobCost({
          actualCost: r.directCost + num(overheadPerJob),
          revenue: r.revenue,
        }).marginPct,
    );
    netMarginPct =
      sample < COUNT_FLOOR
        ? kpi({
            sampleSize: sample,
            reason: "below_floor",
            floor: COUNT_FLOOR,
            remaining: COUNT_FLOOR - sample,
            raw: base,
          })
        : kpi({
            value: round1(median(netPcts)),
            sampleSize: sample,
            incomplete: incompleteCount > 0,
            incompleteJobs: incompleteCount,
            raw: { ...base, overheadPerJob: round2(overheadPerJob) },
          });
  }

  return {
    grossMarginPct,
    netMarginPct,
    labourCostPctOfRevenue: buildLabourCostPct(rows, base),
    materialsTrap,
  };
}

/** Sum(labour cost) / Sum(revenue) — a company-wide ratio, not a per-job median: a
 *  wage bill is a single line the owner reads as one number, not a "typical job". */
function buildLabourCostPct(rows, base) {
  const sample = rows.length;
  if (sample === 0) {
    return kpi({ sampleSize: 0, reason: "no_priced_jobs", raw: base });
  }
  if (sample < COUNT_FLOOR) {
    return kpi({
      sampleSize: sample,
      reason: "below_floor",
      floor: COUNT_FLOOR,
      remaining: COUNT_FLOOR - sample,
      raw: base,
    });
  }
  const revenue = round2(rows.reduce((s, r) => s + r.revenue, 0));
  const labour = round2(rows.reduce((s, r) => s + r.labourCost, 0));
  const incompleteCount = rows.filter((r) => r.incomplete).length;
  if (revenue <= 0) {
    return kpi({ sampleSize: sample, reason: "no_revenue_in_period", raw: base });
  }
  return kpi({
    value: round1((labour / revenue) * 100),
    sampleSize: sample,
    incomplete: incompleteCount > 0,
    incompleteJobs: incompleteCount,
    raw: { ...base, revenue, labour },
  });
}

/**
 * Revenue per active worker, for the period. A snapshot ratio, not a median —
 * "the whole team billed $X per head this month" is one sentence about the
 * company, and splitting it per job would answer a question nobody asked.
 *
 * @param {number} periodRevenue    PAID invoice total in the period — the same
 *                                  cash measure lib/analytics/overview.js uses
 *                                  for "Revenue this month", so this card and
 *                                  that one can never quietly disagree.
 * @param {number} activeWorkerCount  headcount NOW, not "in the period" — a
 *                                  worker count has no historical record to
 *                                  read, so this is a snapshot ratio and says so.
 */
export function buildRevenuePerEmployee({ periodRevenue = 0, activeWorkerCount = 0 } = {}) {
  if (activeWorkerCount <= 0) {
    return kpi({ sampleSize: 0, reason: "no_active_workers" });
  }
  return kpi({
    value: round2(periodRevenue / activeWorkerCount),
    sampleSize: activeWorkerCount,
    raw: { periodRevenue: round2(periodRevenue), activeWorkerCount },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * On-time completion: scheduled → completed ONLY. Job carries no `startedAt`,
 * so this file makes no claim about cycle time — only whether the job finished
 * on or before the date its work was actually scheduled for.
 *
 * ── What "scheduled for" means here ─────────────────────────────────────────
 *
 * The LATEST `scheduledAt` among the job's own JobVisit rows. Not the first:
 * a rescheduled visit is OVERWRITTEN in place
 * (app/api/jobs/[id]/visits/[visitId]/route.js sets `scheduledAt` directly,
 * with no history kept), so the current value already reflects the date that
 * was actually agreed with the client. Comparing against a phantom original
 * date the system no longer has any record of would score a job "late" for
 * finishing exactly when it was told to.
 *
 * A job with no visit at all has no schedule to measure against — excluded and
 * counted, never assumed to be either on time or late.
 *
 * @param {object[]} jobs  completed in range, each
 *   `{ id, title, completedAt, visits: [{scheduledAt}] }`
 */
export function buildOnTimeCompletion({ jobs = [] } = {}) {
  let onTime = 0;
  let late = 0;
  let noSchedule = 0;
  // A per-job breakdown, most recent first, capped — this is what the Gantt
  // strip on the KPI page draws: one row per job, scheduled date to completed
  // date. A dashboard, not an export; twenty rows is plenty to read the shape.
  const jobBreakdown = [];
  for (const job of jobs || []) {
    const visits = Array.isArray(job?.visits) ? job.visits : [];
    const scheduledDates = visits.map((v) => dayKey(v?.scheduledAt)).filter(Boolean);
    const completedDay = dayKey(job?.completedAt);
    if (scheduledDates.length === 0 || !completedDay) {
      noSchedule += 1;
      continue;
    }
    const firstScheduled = scheduledDates.sort()[0];
    const lastScheduled = scheduledDates.at(-1);
    const wasOnTime = completedDay <= lastScheduled;
    if (wasOnTime) onTime += 1;
    else late += 1;
    jobBreakdown.push({
      jobId: job.id,
      title: job.title || "Untitled job",
      scheduledStart: firstScheduled,
      scheduledEnd: lastScheduled,
      completedAt: completedDay,
      onTime: wasOnTime,
    });
  }
  jobBreakdown.sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1));
  const decided = onTime + late;
  const result = rateKpi(onTime, decided, {
    noneYetReason: "no_scheduled_jobs",
    belowFloorReason: "below_floor",
  });
  return {
    ...result,
    jobs: jobBreakdown.slice(0, 20),
    raw: { onTime, late, excludedNoSchedule: noSchedule, jobsInRange: (jobs || []).length },
  };
}

/**
 * Labour utilisation, for the period — a straight pass-through of
 * lib/costing/utilisation.js's own arithmetic, expressed as one percentage:
 * job hours actually logged, over the hours a schedule was guaranteed for.
 *
 * @param {object[]} workers        active, field workers with a schedule/rate
 * @param {object}   jobHoursById   { [workerId]: approved hours on a job }
 * @param {number}   weeksInPeriod
 */
export function buildUtilisationRate({ workers = [], jobHoursById = {}, weeksInPeriod = 0 } = {}) {
  const result = labourUtilisation({ workers, jobHoursById, weeks: weeksInPeriod });
  const scheduled = result.rows.reduce((s, r) => s + (r.scheduledHours ?? 0), 0);
  const jobHours = result.rows.reduce((s, r) => s + r.jobHours, 0);
  const withSchedule = result.rows.filter((r) => r.scheduledHours !== null).length;

  if (withSchedule === 0) {
    return kpi({
      sampleSize: 0,
      reason: "no_scheduled_hours",
      raw: { ...result, scheduledHours: 0, jobHours },
    });
  }
  return kpi({
    value: round1((jobHours / scheduled) * 100),
    sampleSize: withSchedule,
    incomplete: result.incomplete,
    unabsorbedCost: result.unabsorbedCost,
    unratedWorkers: result.unratedWorkers,
    raw: { ...result, scheduledHours: round2(scheduled), jobHours: round2(jobHours) },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// QUALITY — callbacks and change orders, the two figures this file used to
// refuse outright (see the old NOT_TRACKED entries this replaced, and
// docs/CALLBACKS-AND-CHANGE-ORDERS.md for the full argument)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Merge both shapes a callback can take into one reasons-by-job map, keyed by
 * the ORIGINAL job's id — see buildReworkCallbackRate's own comment for what
 * the two shapes are and why "not our fault" still gets recorded here even
 * though it won't count toward the rate.
 *
 * Pulled out of the route as its own pure function so the one genuinely
 * tricky case — a callback job that points at an original NOT in this
 * period's completed set — has somewhere to be executed against rather than
 * just reasoned about. See scripts/check-kpis.mjs for that fixture.
 *
 * @param {object[]} visitReturns  every `{ jobId, returnReason }` pair off
 *   completed jobs' own visits (a same-job touch-up).
 * @param {object[]} callbackJobs  every `{ originalJobId, callbackReason }`
 *   row for a job that points BACK at one of these as a bigger return. A row
 *   whose originalJobId names a job that ISN'T in the caller's completed set
 *   (the original finished in an earlier period, or hasn't finished at all)
 *   is harmless: it lands in the returned map same as any other, and
 *   buildReworkCallbackRate's caller simply never looks it up because that
 *   job id never appears in the `jobs` array it builds — an orphaned reason
 *   has nowhere to attach, not a crash and not a silently wrong count.
 * @returns {Map<string, Set<string>>}
 */
export function mergeCallbackReasons({ visitReturns = [], callbackJobs = [] } = {}) {
  const byJob = new Map();
  const add = (jobId, reason) => {
    if (!jobId || !reason) return;
    if (!byJob.has(jobId)) byJob.set(jobId, new Set());
    byJob.get(jobId).add(reason);
  };
  for (const v of visitReturns || []) add(v?.jobId, v?.returnReason);
  for (const cb of callbackJobs || []) add(cb?.originalJobId, cb?.callbackReason);
  return byJob;
}

/**
 * What fraction of completed jobs needed the company to go BACK — a redo
 * (rework) or covered work returning (warranty). Deliberately NOT every
 * return visit: "not our fault" (the client thought something was missing and
 * it wasn't) is recorded but excluded from the numerator, on the owner's own
 * reasoning — "if everything gets filed as rework, the rate is wrong and the
 * contractor stops trusting it."
 *
 * @param {object[]} jobs  completed jobs, EXCLUDING jobs that are themselves
 *   a callback (Job.originalJobId set) — see the route's own comment for why:
 *   a warranty-return job isn't "new work" being measured for whether it, in
 *   turn, needed a return, and counting it in the denominator would dilute
 *   the rate with jobs that were never a fresh piece of work to begin with.
 *   Each row: `{ id, callbackReasons: string[] }` — every reason recorded
 *   against this job, from either JobVisit.returnReason (a same-job
 *   touch-up) or a linked callback Job's own callbackReason (a bigger
 *   return), already merged by the caller.
 */
export function buildReworkCallbackRate({ jobs = [] } = {}) {
  let reworkCount = 0;
  let warrantyCount = 0;
  let notOurFaultOnly = 0;
  let callbackJobs = 0;
  for (const job of jobs || []) {
    const reasons = new Set(job?.callbackReasons || []);
    const hasRework = reasons.has("rework");
    const hasWarranty = reasons.has("warranty");
    if (hasRework) reworkCount += 1;
    if (hasWarranty) warrantyCount += 1;
    if (hasRework || hasWarranty) {
      callbackJobs += 1;
    } else if (reasons.has("not_our_fault")) {
      notOurFaultOnly += 1;
    }
  }
  const result = rateKpi(callbackJobs, jobs.length, {
    // Reused rather than a new code: "no completed jobs this period" is the
    // exact same fact buildMarginRollup already names this way, and a fourth
    // reworded copy of the same sentence would be the drift AGENTS.md failure
    // class 4 warns about.
    noneYetReason: "no_completed_jobs",
    belowFloorReason: "below_floor",
  });
  return {
    ...result,
    raw: {
      jobsInRange: jobs.length,
      callbackJobs,
      reworkCount,
      warrantyCount,
      notOurFaultOnly,
    },
  };
}

/**
 * What fraction of completed jobs had at least one scope change agreed after
 * the client accepted the quote — see the ChangeOrder model's own header for
 * why this is a deliberate log, never inferred from a quote or invoice edit.
 *
 * Unlike buildReworkCallbackRate, the population here is EVERY completed job
 * in the period, callback jobs included: whether a job is itself a return
 * has nothing to do with whether its own scope changed mid-way.
 *
 * @param {object[]} jobs  completed jobs, each
 *   `{ id, changeOrders: [{ priceDelta: number }] }`
 */
export function buildChangeOrderRate({ jobs = [] } = {}) {
  let jobsWithChangeOrder = 0;
  let totalChangeOrders = 0;
  let totalPriceDelta = 0;
  for (const job of jobs || []) {
    const orders = job?.changeOrders || [];
    if (orders.length > 0) jobsWithChangeOrder += 1;
    totalChangeOrders += orders.length;
    for (const co of orders) totalPriceDelta += num(co?.priceDelta);
  }
  const result = rateKpi(jobsWithChangeOrder, jobs.length, {
    noneYetReason: "no_completed_jobs",
    belowFloorReason: "below_floor",
  });
  return {
    ...result,
    raw: {
      jobsInRange: jobs.length,
      jobsWithChangeOrder,
      totalChangeOrders,
      totalPriceDelta: round2(totalPriceDelta),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SAFETY — see lib/analytics/safety.js for the denominator argument in full
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Incidents per 1,000 approved labour hours, for the period — a straight
 * pass-through of safetyIncidentSummary's own arithmetic, envelope-shaped the
 * way every other figure on this page is.
 *
 * Floored on HOURS, not on incident COUNT — see MIN_HOURS_FOR_RATE's own
 * comment for why a rate meant to describe something rare uses a different
 * kind of floor than win rate or on-time completion.
 *
 * @param {object[]} incidents      SafetyIncident rows for the period
 * @param {number}   approvedHours  sum of approved TimeEntry.hours, SAME period
 */
export function buildSafetyIncidentRate({ incidents = [], approvedHours = 0 } = {}) {
  const result = safetyIncidentSummary({ incidents, approvedHours });
  if (result.value === null) {
    return kpi({
      sampleSize: result.raw.count,
      reason: result.reason,
      // Named on the envelope, the same way below_floor names {floor} — see
      // that reason's own comment for why the number lives here rather than
      // typed into the sentence: a REASONS string with a bare digit in it
      // cannot be corrected in one place if MIN_HOURS_FOR_RATE ever changes.
      minHours: MIN_HOURS_FOR_RATE,
      raw: result.raw,
    });
  }
  return kpi({ value: result.value, sampleSize: result.raw.count, raw: result.raw });
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKETING — the honest ratio the per-channel refusal below doesn't cover
// ═══════════════════════════════════════════════════════════════════════════
//
// costPerLead (in NOT_TRACKED below) is refused PER CHANNEL because nothing
// links a dollar of Meta/Google/pamphlet spend to a specific LeadRequest —
// see docs/META-ADS-INTEGRATION.md Part 2. This is the different, honest
// claim Part 2's "Level 1" describes: total marketing spend across every
// channel, divided by total REAL leads across every live intake channel, for
// the same period. It never claims which channel produced which lead — only
// a real total over a real total, the same kind of company-wide ratio
// buildRevenuePerEmployee already states safely elsewhere in this file.
//
// `manual` and `imported` LeadRequest sources are excluded from the
// denominator by default: a bulk CSV import of old leads or a staff member
// typing in a walk-in customer isn't something this period's marketing
// spend caused, and folding them in would quietly deflate the figure. The
// exclusion count is always returned so the UI can show it rather than
// silently drop it — "+ 4 leads entered manually, not counted" — matching
// the incomplete/reason discipline this file uses everywhere else.
const BLENDED_CPL_EXCLUDED_SOURCES = new Set(["manual", "imported"]);

/**
 * @param {number} totalSpend            sum(MarketingSpend.amount) for the
 *                                        period, across every channel —
 *                                        rows flagged with a currency that
 *                                        differs from the company's own
 *                                        (see MarketingSpend.currency) must
 *                                        already be excluded by the caller,
 *                                        the same way a mismatched-currency
 *                                        row is excluded from
 *                                        lib/analytics/marketingRollup.js's
 *                                        channel totals.
 * @param {object} leadCountsBySource    { [LeadRequest.source]: count } for
 *                                        the same period — a plain groupBy,
 *                                        computed by the caller (this file
 *                                        stays db-free, see the file header).
 */
export function buildBlendedCostPerLead({ totalSpend = 0, leadCountsBySource = {} } = {}) {
  let counted = 0;
  let excluded = 0;
  for (const [source, rawCount] of Object.entries(leadCountsBySource || {})) {
    const count = Number(rawCount) || 0;
    if (BLENDED_CPL_EXCLUDED_SOURCES.has(source)) excluded += count;
    else counted += count;
  }
  if (counted <= 0) {
    return kpi({ sampleSize: 0, reason: "no_leads_in_period", excludedCount: excluded });
  }
  return kpi({
    value: round2((Number(totalSpend) || 0) / counted),
    sampleSize: counted,
    excludedCount: excluded,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// WHAT THIS FILE DELIBERATELY DOES NOT BUILD
// ═══════════════════════════════════════════════════════════════════════════
//
// Three metrics a KPI dashboard is normally expected to carry, and the reason
// each one is a "not tracked" panel instead of a number: inventing the number
// is the exact failure this codebase keeps getting swept for.
//
// This list keeps shrinking, which is the point of it. Rework/callback rate
// and change-order rate left when JobVisit.returnReason, Job.originalJobId
// and the ChangeOrder model gave this file something honest to compute from
// (docs/CALLBACKS-AND-CHANGE-ORDERS.md). Customer satisfaction left when
// SatisfactionResponse gave it something that actually asks and something
// that actually summarises (docs/CUSTOMER-SATISFACTION.md). Both changes
// landed in parallel and both removed an entry from here, which is why this
// comment counts three rather than four or five.

export const NOT_TRACKED = [
  {
    key: "costPerLead",
    label: "Cost per lead",
    reason:
      "MarketingSpend.leads is typed in by hand, and no lead — LeadRequest — carries a campaignId or a UTM value. A cost-per-lead figure built on a hand-typed denominator and no source attribution would look precise and mean nothing.",
  },
  // Three keys used to sit between these two: safetyIncidentRate,
  // reworkCallbackRate and csat. All three now have real builders, and all
  // three were removed by a DIFFERENT branch — so every merge in turn offered
  // one removal and silently restored the other two. Taking either side would
  // have put a "not tracked" panel back over a metric this file genuinely
  // computes, which is a lie told on a dashboard.
  {
    key: "equipmentUtilisation",
    label: "Equipment utilisation",
    reason:
      "AssetUseLog now records which asset was on which job, and GET /api/assets/utilisation reports it — but as its own screen at Settings → Assets, next to the depreciation register it explains, not rolled into this KPI period. A yard's utilisation isn't naturally a per-period rate the way the figures on this page are, and forcing it into one (\"held 62% of days this month\") would invent a claim about how many days it SHOULD have been in use that nothing in the product states.",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOMER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Average satisfaction score for the period, off SatisfactionResponse.
 *
 * Floored at COUNT_FLOOR, not RATE_FLOOR: this is a central figure over a
 * handful of answers (the average score IS the claim, the way avgJobValue and
 * the margin figures are), not a share of a large population deciding
 * something binary — exactly the distinction lib/analytics/kpis.js's own
 * header draws between the two floors.
 *
 * ── Why this reads respondedAt-not-null rows only ───────────────────────────
 *
 * A SatisfactionResponse row is created the moment the email goes out, before
 * anyone has answered — see app/api/cron/review-requests/route.js. Counting
 * unanswered rows would silently understate the average toward whatever a
 * blank score defaults to, which is exactly the "padding absent data with
 * defaults" failure class AGENTS.md names. sampleSize is answers, never sends.
 *
 * @param {object[]} responses  answered rows for completed jobs in the
 *   period, each `{ score }` — 1–5, never null (the caller has already
 *   filtered to `respondedAt: { not: null }`; see
 *   app/api/analytics/kpis/route.js).
 */
export function buildCsat({ responses = [] } = {}) {
  const scores = (responses || [])
    .map((r) => Number(r?.score))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5);

  if (scores.length === 0) {
    return kpi({ sampleSize: 0, reason: "no_survey_responses", floor: COUNT_FLOOR });
  }
  if (scores.length < COUNT_FLOOR) {
    return kpi({
      sampleSize: scores.length,
      reason: "below_floor",
      floor: COUNT_FLOOR,
      remaining: COUNT_FLOOR - scores.length,
    });
  }

  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  for (const s of scores) {
    counts[s] += 1;
    sum += s;
  }

  return kpi({
    value: round1(sum / scores.length),
    sampleSize: scores.length,
    // Named, not escalated — AGENTS.md's own instruction here is "learn about
    // it quickly, don't build an alert nobody asked for." This is the read
    // side of that: the count is on the envelope for a screen to highlight,
    // with no email/SMS/task fired off the back of it.
    raw: { counts, lowScoreCount: counts[1] + counts[2] },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// The entry point
// ═══════════════════════════════════════════════════════════════════════════

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The whole KPI set for one period.
 *
 * Every DB read this needs has already happened by the time this is called —
 * see app/api/analytics/kpis/route.js for the queries. This function only
 * arranges and grades what it is handed.
 *
 * @param {object} p
 * @param {string} p.from  YYYY-MM-DD, inclusive
 * @param {string} p.to    YYYY-MM-DD, inclusive
 * @param {string} p.currency
 * @param {object} p.sales       { quotes, undatedCount, leads }
 * @param {object} p.profit      { completedJobsWithCost, overheadPerJob, materialsTrap, periodRevenue, activeWorkerCount }
 * @param {object} p.execution   { estimateAccuracyJobs, onTimeJobs, utilisation: { workers, jobHoursById } }
 * @param {object} p.quality     { reworkJobs, changeOrderJobs } — see buildReworkCallbackRate
 *                                and buildChangeOrderRate for the shape each array's rows take
 * @param {object} p.cash        { invoices, payments }
 * @param {object} p.customer    { satisfactionResponses } — answered SatisfactionResponse rows for completed jobs in the period; see buildCsat()
 * @param {object} p.safety      { incidents, approvedHours }
 * @param {number} p.weeksInPeriod
 */
export function buildKpis({
  from,
  to,
  currency = null,
  sales = {},
  profit = {},
  execution = {},
  quality = {},
  cash = {},
  customer = {},
  safety = {},
  weeksInPeriod = 0,
} = {}) {
  if (!DAY_RE.test(from || "") || !DAY_RE.test(to || "")) {
    const err = new Error("Give a start and end date as from=YYYY-MM-DD&to=YYYY-MM-DD.");
    err.status = 400;
    throw err;
  }
  if (from > to) {
    const err = new Error(`The period runs backwards (${from} to ${to}).`);
    err.status = 400;
    throw err;
  }
  // Estimate accuracy and every profit KPI are money figures, and this file
  // will not stamp a currency on them the company never set — the same refusal
  // app/api/analytics/estimate-accuracy/route.js already makes. The route
  // checks Company.currency BEFORE calling this and never gets here with null.
  if (!currency) {
    const err = new Error(
      "Your company has no billing currency set, and this report will not assume one.",
    );
    err.status = 409;
    err.code = "no_currency";
    throw err;
  }

  const { winRate, avgJobValue, winLossCounts } = buildSalesFromWinLoss({
    from,
    to,
    quotes: sales.quotes || [],
    undatedCount: sales.undatedCount || 0,
  });

  const marginRollup = buildMarginRollup({
    jobs: profit.completedJobsWithCost || [],
    overheadPerJob: profit.overheadPerJob ?? null,
    materialsTrap: profit.materialsTrap,
  });

  const receivables = cash.invoices
    ? buildReceivables({ invoices: cash.invoices, payments: cash.payments || [], asOf: cash.asOf })
    : null;

  // Money received, by month — the SAME builder and the SAME payment rows the
  // dashboard's own revenue chart already uses (lib/analytics/receivables.js),
  // called again here rather than re-derived, so the sparkline on this page and
  // the chart on app/app/page.js can never quietly disagree about a month.
  const revenueTrend = buildRevenueTrend({
    payments: cash.payments || [],
    months: 6,
    everRecorded: (cash.payments || []).length > 0,
    asOf: cash.asOf,
  });

  const estimateAccuracy = buildEstimateAccuracy({
    from,
    to,
    currency,
    jobs: execution.estimateAccuracyJobs || [],
    minSample: ESTIMATE_ACCURACY_MIN_SAMPLE,
  });

  return {
    range: { from, to },
    currency,
    weeksInPeriod: round1(weeksInPeriod),
    sales: {
      winRate,
      avgJobValue,
      leadToQuoteConversion: buildLeadToQuoteConversion({ leads: sales.leads || [] }),
      backlogWeeks: buildBacklogWeeks({
        openJobs: sales.openJobs || [],
        completedJobs: sales.completedJobsForThroughput || [],
        weeksInPeriod,
      }),
      winLossCounts,
    },
    profit: {
      grossMarginPct: marginRollup.grossMarginPct,
      netMarginPct: marginRollup.netMarginPct,
      labourCostPctOfRevenue: marginRollup.labourCostPctOfRevenue,
      revenuePerEmployee: buildRevenuePerEmployee({
        periodRevenue: profit.periodRevenue || 0,
        activeWorkerCount: profit.activeWorkerCount || 0,
      }),
      materialsTrap: marginRollup.materialsTrap || null,
    },
    execution: {
      estimateAccuracy,
      onTimeCompletion: buildOnTimeCompletion({ jobs: execution.onTimeJobs || [] }),
      utilisation: buildUtilisationRate({
        workers: execution.utilisation?.workers || [],
        jobHoursById: execution.utilisation?.jobHoursById || {},
        weeksInPeriod,
      }),
    },
    quality: {
      reworkCallbackRate: buildReworkCallbackRate({ jobs: quality.reworkJobs || [] }),
      changeOrderRate: buildChangeOrderRate({ jobs: quality.changeOrderJobs || [] }),
    },
    cash: {
      arAging: receivables
        ? kpi({
            // A real zero (nothingOutstanding) and no evidence at all
            // (noInvoices) both sum to $0 — but only one of them is a
            // statement this file will make. AGENTS.md failure class 5.
            value: receivables.noInvoices ? null : receivables.total,
            sampleSize: receivables.count,
            incomplete: receivables.notPlaced > 0 || receivables.paymentsNotPlaced > 0,
            reason: receivables.noInvoices ? "no_invoices" : null,
            aging: receivables.aging,
            overdueTotal: receivables.overdueTotal,
            overdueCount: receivables.overdueCount,
            undatedTotal: receivables.undatedTotal,
            undatedCount: receivables.undatedCount,
            nothingOutstanding: receivables.nothingOutstanding,
            noInvoices: receivables.noInvoices,
          })
        : kpi({ sampleSize: 0, reason: "no_invoices" }),
      revenueTrend,
    },
    customer: {
      csat: buildCsat({ responses: customer.satisfactionResponses || [] }),
    },
    safety: {
      incidentRate: buildSafetyIncidentRate({
        incidents: safety.incidents || [],
        approvedHours: safety.approvedHours || 0,
      }),
    },
    notTracked: NOT_TRACKED,
  };
}
