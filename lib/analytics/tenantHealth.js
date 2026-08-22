// lib/analytics/tenantHealth.js
//
// How the companies using FieldQuo are actually doing — by trade, by funnel
// stage, and by whether they are still showing up.
//
// ── What this is for ───────────────────────────────────────────────────────
//
// The tenant board showed three totals: quoted value, invoiced value, quotes
// this month. That answers "is anything happening" and nothing else. It cannot
// tell you that roofers convert at twice the rate of painters, that eleven
// companies have not written a quote in a month, or that the median cabinet
// quote is $4,800 — which are the things that say whether the product is
// working for the people paying for it.
//
// ── Rules that apply to every number in here ───────────────────────────────
//
//   * Demo companies are excluded by the caller. They are sales fixtures and
//     they contributed 99% of the old dashboard's money.
//
//   * A rate needs a denominator worth dividing by. One quote does not make a
//     win rate, and "100%" from a single sample is the most misleading number
//     a dashboard can print.
//
//     But a BLANK is not the answer either. "1 of 2 won" is honest, useful,
//     and carries its own sample size; "—" reads as broken software and tells
//     the reader nothing they didn't already have. So below MIN_SAMPLE the
//     ratio is reported as a FRACTION and the percentage stays null. The
//     precision drops; the information doesn't.
//
//   * Drafts are not attempts. Win rate is accepted ÷ SENT, because a quote
//     nobody sent was never lost; it was never tried. Counting drafts as
//     losses would make every company look worse the more carefully they work.
//
//   * Median for money, not mean. One $168k roofing job should not define what
//     a roofing quote is worth.

/// Below this many samples, a percentage is noise wearing a decimal point.
export const MIN_SAMPLE = 5;

/// A company that hasn't written a quote in this long has stopped using the
/// product for the thing it is for. Not churn — churn is a billing event —
/// but the signal that precedes it.
export const DORMANT_DAYS = 30;

const pct = (n, d) =>
  d >= MIN_SAMPLE && d > 0 ? Math.round((n / d) * 1000) / 10 : null;

/**
 * A rate a human can read at any sample size.
 *
 * Above the floor: "60%". Below it: "1 of 2". Nothing at all: "—".
 *
 * Returned as a string from here rather than left to each screen, so a thin
 * ratio reads identically everywhere — the alternative is every UI inventing
 * its own fallback, and the one that gets it wrong is the one nobody looks at.
 */
export function formatRate(n, d) {
  if (!d) return "—";
  const p = pct(n, d);
  return p === null ? `${n} of ${d}` : `${p}%`;
}

const money = (n) => Math.round(Number(n || 0) * 100) / 100;

function median(values) {
  const s = values
    .map(Number)
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return money(s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
}

const daysBetween = (a, b) => (new Date(b) - new Date(a)) / 86400000;

/**
 * The whole funnel, one stage at a time.
 *
 * Each stage's rate is measured against the stage BEFORE it, not against the
 * top. A single "3% quote-to-paid" number hides which step is leaking, which
 * is the only thing the number would be useful for.
 */
export function buildFunnel(quotes, jobs, invoices) {
  const q = Array.isArray(quotes) ? quotes : [];
  const j = Array.isArray(jobs) ? jobs : [];
  const i = Array.isArray(invoices) ? invoices : [];

  const created = q.length;
  const sent = q.filter((x) => x.sentAt || x.status !== "draft").length;
  const accepted = q.filter((x) => x.status === "accepted").length;
  const declined = q.filter((x) => x.status === "declined").length;
  const jobsCreated = j.length;
  const jobsCompleted = j.filter((x) => x.status === "completed").length;
  const invoiced = i.length;
  const paid = i.filter((x) => x.status === "paid").length;

  return {
    stages: [
      { key: "created", label: "Quotes created", count: created, rate: null, rateLabel: "—" },
      { key: "sent", label: "Sent to a client", count: sent, rate: pct(sent, created) , rateLabel: formatRate(sent, created) },
      { key: "accepted", label: "Accepted", count: accepted, rate: pct(accepted, sent) , rateLabel: formatRate(accepted, sent) },
      { key: "job", label: "Became a job", count: jobsCreated, rate: pct(jobsCreated, accepted) , rateLabel: formatRate(jobsCreated, accepted) },
      { key: "completed", label: "Job completed", count: jobsCompleted, rate: pct(jobsCompleted, jobsCreated) , rateLabel: formatRate(jobsCompleted, jobsCreated) },
      { key: "invoiced", label: "Invoiced", count: invoiced, rate: pct(invoiced, jobsCompleted) , rateLabel: formatRate(invoiced, jobsCompleted) },
      { key: "paid", label: "Paid", count: paid, rate: pct(paid, invoiced) , rateLabel: formatRate(paid, invoiced) },
    ],
    // The headline every CRM quotes at itself. Decided against sent rather
    // than created, for the reason in the header.
    winRate: pct(accepted, sent),
    winRateLabel: formatRate(accepted, sent),
    // Of the quotes that got an ANSWER. A quote still sitting unanswered is
    // not a loss, and folding it in understates every company early in a
    // month.
    decidedWinRate: pct(accepted, accepted + declined),
    decidedWinRateLabel: formatRate(accepted, accepted + declined),
    unanswered: sent - accepted - declined,
  };
}

/**
 * Per-trade performance, from the scope groups on each quote.
 *
 * A quote can carry several trades — a kitchen job is cabinets AND
 * countertops AND flooring. It is counted once under EACH, and its value is
 * attributed by scope-group subtotal rather than by quote total, so a $30k
 * kitchen doesn't credit $30k to flooring.
 */
export function buildTradeBreakdown(scopeRows) {
  const rows = Array.isArray(scopeRows) ? scopeRows : [];
  const byTrade = new Map();

  for (const r of rows) {
    const key = r.categoryKey;
    if (!key) continue;
    if (!byTrade.has(key)) {
      byTrade.set(key, {
        categoryKey: key,
        label: r.categoryLabel || key,
        quotes: 0,
        sent: 0,
        accepted: 0,
        declined: 0,
        values: [],
        acceptedValues: [],
        companies: new Set(),
        jobs: 0,
        jobsCompleted: 0,
      });
    }
    const t = byTrade.get(key);
    t.quotes += 1;
    t.companies.add(r.companyId);

    const wasSent = Boolean(r.sentAt) || r.status !== "draft";
    if (wasSent) t.sent += 1;
    if (r.status === "accepted") t.accepted += 1;
    if (r.status === "declined") t.declined += 1;

    const value = Number(r.scopeSubtotal ?? r.quoteTotal ?? 0);
    if (value > 0) {
      t.values.push(value);
      if (r.status === "accepted") t.acceptedValues.push(value);
    }

    if (r.jobCount) t.jobs += r.jobCount;
    if (r.completedJobCount) t.jobsCompleted += r.completedJobCount;
  }

  return [...byTrade.values()]
    .map((t) => ({
      categoryKey: t.categoryKey,
      label: t.label,
      companies: t.companies.size,
      quotes: t.quotes,
      sent: t.sent,
      accepted: t.accepted,
      declined: t.declined,
      jobs: t.jobs,
      jobsCompleted: t.jobsCompleted,
      // Null below MIN_SAMPLE — see the header. The UI renders "—".
      winRate: pct(t.accepted, t.sent),
      // What the UI prints. The raw winRate stays null below the floor so
      // nothing sorts or compares on a number that isn't really there.
      winRateLabel: formatRate(t.accepted, t.sent),
      medianQuote: median(t.values),
      medianWon: median(t.acceptedValues),
      pipelineValue: money(t.values.reduce((n, v) => n + v, 0)),
      wonValue: money(t.acceptedValues.reduce((n, v) => n + v, 0)),
      // Flagged so a UI can mark a row as indicative rather than measured,
      // instead of quietly showing a blank where a number should be.
      thin: t.sent < MIN_SAMPLE,
    }))
    .sort((a, b) => b.quotes - a.quotes || a.label.localeCompare(b.label));
}

/**
 * Which companies are thriving, coasting, or gone quiet.
 *
 * Deliberately not called "churn risk". Churn is a billing event with a date;
 * this is activity, and a roofer quiet through February is seasonal, not
 * leaving. Naming it "dormant" keeps the software from asserting a motive it
 * cannot know.
 */
export function buildCompanyHealth(companies, now = new Date()) {
  const list = Array.isArray(companies) ? companies : [];
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - DORMANT_DAYS);

  const scored = list.map((c) => {
    const last = c.lastQuoteAt ? new Date(c.lastQuoteAt) : null;
    const state = !last
      ? "never_quoted"
      : last >= cutoff
        ? "active"
        : "dormant";

    return {
      id: c.id,
      name: c.name,
      state,
      quotes: c.quoteCount || 0,
      lastQuoteAt: c.lastQuoteAt || null,
      daysSinceLastQuote: last ? Math.floor(daysBetween(last, now)) : null,
      // Activation: signup → first quote. The single clearest predictor of
      // whether a trial becomes a customer, and the one number an onboarding
      // change should move.
      daysToFirstQuote:
        c.createdAt && c.firstQuoteAt
          ? Math.max(0, Math.round(daysBetween(c.createdAt, c.firstQuoteAt)))
          : null,
      trades: c.trades || [],
    };
  });

  const byState = (s) => scored.filter((c) => c.state === s);
  const activated = scored.filter((c) => c.daysToFirstQuote !== null);

  return {
    companies: scored.sort((a, b) => (b.quotes || 0) - (a.quotes || 0)),
    counts: {
      total: scored.length,
      active: byState("active").length,
      dormant: byState("dormant").length,
      neverQuoted: byState("never_quoted").length,
    },
    activation: {
      // Of companies that exist, how many ever wrote one quote. The blunt
      // measure of whether onboarding works at all.
      rate: pct(activated.length, scored.length),
      medianDaysToFirstQuote: median(activated.map((c) => c.daysToFirstQuote)),
      // Same day counts as 0, which median() would drop as falsy — so it is
      // reported separately rather than silently excluded.
      sameDay: activated.filter((c) => c.daysToFirstQuote === 0).length,
    },
    // Named individually because "11 dormant" is a number and "these eleven"
    // is something you can act on.
    needsAttention: scored
      .filter((c) => c.state === "dormant")
      .sort((a, b) => (b.quotes || 0) - (a.quotes || 0))
      .slice(0, 10),
  };
}

/**
 * Which parts of the product are actually being used.
 *
 * Adoption is measured per COMPANY, not per record: one company generating
 * four hundred instant quotes is one company that adopted the feature, and
 * counting records would let a single enthusiastic tenant read as
 * product-wide success.
 */
export function buildAdoption(companies, totals) {
  const list = Array.isArray(companies) ? companies : [];
  const n = list.length;
  const share = (k) => ({
    companies: list.filter((c) => c[k]).length,
    rate: pct(list.filter((c) => c[k]).length, n),
  });

  return {
    totalCompanies: n,
    instantQuotes: share("usesInstantQuotes"),
    checklists: share("usesChecklists"),
    booking: share("usesBooking"),
    ai: share("usesAi"),
    invoicing: share("usesInvoicing"),
    // Instant vs hand-built, as a share of quotes rather than companies —
    // here the record count IS the question being asked.
    quoteMix: {
      instant: totals?.instantQuotes || 0,
      manual: Math.max(0, (totals?.totalQuotes || 0) - (totals?.instantQuotes || 0)),
      instantShare: pct(totals?.instantQuotes || 0, totals?.totalQuotes || 0),
    },
  };
}
