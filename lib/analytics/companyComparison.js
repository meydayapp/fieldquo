// lib/analytics/companyComparison.js
//
// One company's numbers, next to what everyone else's look like.
//
// ── What this is for ───────────────────────────────────────────────────────
//
// A contractor rings up and asks why work has gone quiet, or you ring them
// because it has. "Your win rate is 38%" means nothing on its own — 38% could
// be excellent for a trade where every job is competitively bid, or terrible
// for one where the quote is a formality. "Your win rate is 38%, the median
// across companies like you is 61%" is a conversation.
//
// ── The comparison must be able to say "I don't know" ──────────────────────
//
// Three separate ways this could produce a confident wrong answer, and each
// gets its own guard:
//
//   1. THEIR sample is thin. Two quotes is not a win rate. Reported as a
//      fraction and explicitly marked not-comparable.
//
//   2. The COHORT is thin. A median across three companies is not "the
//      market"; it is three companies. Below MIN_COHORT_COMPANIES no
//      comparison is offered at all — the company's own number is still
//      shown, because that part is real.
//
//   3. The company is IN the cohort. Comparing a company against a median it
//      helped compute flatters small cohorts badly: with four companies, each
//      one is 25% of the thing it is being measured against. The company is
//      always excluded from its own benchmark.
//
// ── Why median, and why a band ─────────────────────────────────────────────
//
// Median for the same reason as everywhere else here: one company doing
// $168k roofing jobs should not define the middle. And a 15% band around it
// counts as "in line", because telling somebody to change a number that is
// already normal is noise, and noise is how advice stops being read.

import { formatRate, MIN_SAMPLE } from "./tenantHealth";

/// Below this many OTHER companies, there is no cohort to compare against.
export const MIN_COHORT_COMPANIES = 4;

/// Inside this band of the median, a company is doing what everyone else does.
export const IN_LINE_BAND = 0.15;

const WON_QUOTE = "accepted";
const LOST_QUOTE = "declined";

function median(values) {
  const s = values
    .filter((v) => v !== null && v !== undefined && v !== "")
    .map(Number)
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  const m = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return Math.round(m * 100) / 100;
}

/**
 * Every metric this comparison knows how to make, for one company.
 *
 * `sample` travels with each value. A metric without its sample size cannot be
 * judged, and every guard downstream reads it.
 */
export function metricsForCompany(rows) {
  const quotes = rows.quotes || [];
  const jobs = rows.jobs || [];
  const invoices = rows.invoices || [];

  const sent = quotes.filter((q) => q.sentAt || q.status !== "draft");
  const won = quotes.filter((q) => q.status === WON_QUOTE);
  const lost = quotes.filter((q) => q.status === LOST_QUOTE);
  const decided = won.length + lost.length;

  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const composeTimes = quotes
    .map((q) => q.composeSeconds)
    .filter((v) => v !== null && v !== undefined && Number(v) > 0);

  const decisionDays = quotes
    .filter((q) => q.sentAt && q.acceptedAt)
    .map((q) => (new Date(q.acceptedAt) - new Date(q.sentAt)) / 86400000)
    .filter((d) => d >= 0);

  return {
    winRate: { value: ratio(won.length, sent.length), sample: sent.length, won: won.length },
    decidedWinRate: { value: ratio(won.length, decided), sample: decided, won: won.length },
    medianQuoteValue: {
      value: median(quotes.map((q) => q.total)),
      sample: quotes.filter((q) => Number(q.total) > 0).length,
    },
    quotesSent: { value: sent.length, sample: sent.length },
    jobCompletionRate: {
      value: ratio(jobs.filter((j) => j.status === "completed").length, jobs.length),
      sample: jobs.length,
      won: jobs.filter((j) => j.status === "completed").length,
    },
    paidRate: {
      value: ratio(paidInvoices.length, invoices.length),
      sample: invoices.length,
      won: paidInvoices.length,
    },
    medianComposeSeconds: { value: median(composeTimes), sample: composeTimes.length },
    medianDecisionDays: { value: median(decisionDays), sample: decisionDays.length },
  };
}

function ratio(n, d) {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : null;
}

/// How each metric should be read. A LOW compose time is good; a low win rate
/// is not. Without this the UI would congratulate a company for being slow.
const DIRECTION = {
  winRate: "higher",
  decidedWinRate: "higher",
  medianQuoteValue: "higher",
  quotesSent: "higher",
  jobCompletionRate: "higher",
  paidRate: "higher",
  medianComposeSeconds: "lower",
  medianDecisionDays: "lower",
};

const LABELS = {
  winRate: "Win rate",
  decidedWinRate: "Win rate (of answered quotes)",
  medianQuoteValue: "Median quote value",
  quotesSent: "Quotes sent",
  jobCompletionRate: "Jobs completed",
  paidRate: "Invoices paid",
  medianComposeSeconds: "Time to build a quote",
  medianDecisionDays: "Client decision time",
};

/**
 * One company against everyone else.
 *
 * @param subject  metricsForCompany() output for the company in question
 * @param others   metricsForCompany() output for every OTHER company
 */
export function compareToCohort(subject, others) {
  const pool = Array.isArray(others) ? others : [];

  return Object.keys(LABELS).map((key) => {
    const mine = subject?.[key] || { value: null, sample: 0 };

    // Only companies with a real sample contribute to the median. A company
    // with one quote should not help define what a normal win rate is.
    const contributions = pool
      .map((o) => o?.[key])
      .filter((m) => m && m.value !== null && m.sample >= MIN_SAMPLE)
      .map((m) => m.value);

    const cohortMedian = median(contributions);
    const comparable =
      mine.value !== null &&
      mine.sample >= MIN_SAMPLE &&
      contributions.length >= MIN_COHORT_COMPANIES &&
      cohortMedian !== null &&
      cohortMedian !== 0;

    let position = null;
    let deltaPct = null;
    if (comparable) {
      const delta = (mine.value - cohortMedian) / cohortMedian;
      deltaPct = Math.round(delta * 1000) / 10;
      const better = DIRECTION[key] === "higher" ? delta > 0 : delta < 0;
      position =
        Math.abs(delta) <= IN_LINE_BAND ? "in_line" : better ? "ahead" : "behind";
    }

    return {
      key,
      label: LABELS[key],
      direction: DIRECTION[key],
      value: mine.value,
      // A fraction when their own sample is thin — same rule as everywhere
      // else. "1 of 2" beats a blank and beats a fabricated percentage.
      display:
        mine.won !== undefined
          ? formatRate(mine.won, mine.sample)
          : mine.value === null
            ? "—"
            : String(mine.value),
      sample: mine.sample,
      cohortMedian,
      cohortSize: contributions.length,
      position,
      deltaPct,
      comparable,
      // Why a comparison isn't offered, so the screen can say it rather than
      // showing an unexplained dash. These are different problems with
      // different fixes.
      reason: comparable
        ? null
        : mine.value === null
          ? "no_data"
          : mine.sample < MIN_SAMPLE
            ? "their_sample_thin"
            : contributions.length < MIN_COHORT_COMPANIES
              ? "cohort_thin"
              : "no_median",
    };
  });
}

/**
 * The one or two sentences worth opening a phone call with.
 *
 * Only ever drawn from comparable metrics, and it names the metric furthest
 * from the median in each direction rather than listing everything — a call
 * that opens with eight numbers is a call nobody finishes.
 */
export function talkingPoints(comparison) {
  const usable = (comparison || []).filter((c) => c.comparable);
  if (!usable.length) return [];

  const behind = usable
    .filter((c) => c.position === "behind")
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))[0];
  const ahead = usable
    .filter((c) => c.position === "ahead")
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))[0];

  const points = [];
  if (ahead) {
    points.push({
      tone: "good",
      text: `${ahead.label} is ${fmt(ahead.value, ahead.key)} against a median of ${fmt(ahead.cohortMedian, ahead.key)} across ${ahead.cohortSize} other companies.`,
    });
  }
  if (behind) {
    points.push({
      tone: "watch",
      text: `${behind.label} is ${fmt(behind.value, behind.key)} where the median is ${fmt(behind.cohortMedian, behind.key)}. Worth asking what's different about how they work.`,
    });
  }
  return points;
}

function fmt(v, key) {
  if (v === null) return "—";
  if (key === "medianQuoteValue") return `$${Number(v).toLocaleString()}`;
  if (key === "medianComposeSeconds") return `${v}s`;
  if (key === "medianDecisionDays") return `${v} day(s)`;
  if (key === "quotesSent") return String(v);
  return `${v}%`;
}
