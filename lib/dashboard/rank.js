// lib/dashboard/rank.js
//
// The dashboard's ranking, as DATA rather than as JSX.
//
// ══ Why this file exists at all ═════════════════════════════════════════════
//
// /app used to open with three identically-sized tiles and four identically-
// sized panels. Everything was equally important, so nothing was — and two
// overdue invoices sat inside a panel called "Aging", below three other
// panels, described only as a count. The rebuild answers one question first
// ("what needs you today"), then the hero figure, then four secondary
// metrics, then everything else.
//
// The ranking is the part worth testing, and a React tree that fetches its own
// data cannot be executed in a check script. So every decision the top of the
// page makes — does the block render, is there a comparison, is the sample big
// enough to print a percentage, was this member refused — is made here, in a
// pure function over the two payloads the page already fetches, and
// scripts/check-dashboard-rank.mjs runs it against the states that matter.
//
// ══ It computes NO money ════════════════════════════════════════════════════
//
// Not one figure below is derived here. Revenue, quotes sent and conversion
// come from /api/analytics/overview (lib/analytics/overview.js); owed, aging,
// the overdue rows and the received-money series come from
// /api/analytics/receivables (lib/analytics/receivables.js). This file selects,
// orders and REFUSES. Two sources for one figure is how a dashboard starts
// disagreeing with the invoice list.
//
// ══ `null` is not zero, and absence is not a claim ══════════════════════════
//
// Same rule the page's own header states at length: a member without
// showPricing is REFUSED both endpoints, and "$0 revenue" is not a missing
// figure, it is a different and alarming claim about the business. So every
// metric carries `known`, and a metric that is not known renders as nothing —
// no tile, no zero, no dash styled as a change.
//
// The same applies to the appointment count. `/api/appointments` failing used
// to leave the visits tile reading 0, which is the identical fabrication one
// tile to the right; `upcomingCount: null` now means "not known" and the tile
// is absent.
import { compare } from "@/lib/analytics/trend";
// ── Where the floor comes from, and why not from kpis.js ───────────────────
//
// lib/analytics/kpis.js exports RATE_FLOOR, and its own comment says the
// number is not its own: it "restates a floor already argued for elsewhere",
// namely lib/analytics/winLoss.js's SAMPLE_FLOOR — below ten decided outcomes
// one of them flipping moves the rate by more than ten points.
//
// This file imports the ORIGIN rather than the restatement for one mechanical
// reason: kpis.js pulls in estimateAccuracy → actualJobCost → estimateJobCost
// → app/data/tradePriceBooks.js, which is 135 KB of price book, and this module
// is imported by a CLIENT component that a contractor loads in a driveway on a
// bad connection. winLoss.js imports nothing at all. The number is therefore
// still never picked — and scripts/check-dashboard-rank.mjs imports BOTH
// constants and asserts they are equal, so the two cannot drift apart in
// silence.
import { SAMPLE_FLOOR } from "@/lib/analytics/winLoss";

export const RATE_FLOOR = SAMPLE_FLOOR;

/** How many overdue rows the "Needs you today" block names before it links out. */
export const NEEDS_TODAY_LIMIT = 5;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * The invoices that are actually LATE — not "owed", not "aging", late.
 *
 * `dueState` is receivables.js's own three-valued answer and is used verbatim:
 * an invoice with no due date is `undated`, not overdue, and putting it in a
 * block headed "needs you today" would manufacture a deadline nobody agreed
 * to. Already sorted oldest-debt-first by buildReceivables, so no re-sort here
 * — a second ordering is a second thing to disagree with the invoice list
 * about.
 */
export function overdueInvoices(money, limit = NEEDS_TODAY_LIMIT) {
  const rows = money?.receivables?.invoices;
  if (!Array.isArray(rows)) return null; // refused, failed, or not answered yet
  return rows.filter((r) => r?.dueState === "overdue").slice(0, limit);
}

/**
 * Quotes sent this month, and what fraction of them clients accepted.
 *
 * ── The floor, and what it does instead of a percentage ────────────────────
 *
 * Below RATE_FLOOR sent quotes there is NO percentage — not a greyed one, not
 * one with an asterisk. The counts are shown on their own, because "50%" off
 * two quotes is a number a contractor would act on and should not.
 *
 * Above the floor the percentage is shown WITH its counts beside it ("36% ·
 * 5 of 14"), which is the same discipline lib/analytics/kpis.js's envelope
 * keeps by printing `sampleSize` next to every value.
 */
function conversionMetric(overview) {
  if (!overview) return { id: "conversion", known: false, floor: RATE_FLOOR };

  const sent = num(overview.quotesSent) ?? 0;
  const accepted = num(overview.quotesAccepted) ?? 0;
  const rate = overview.conversionRate == null ? null : Number(overview.conversionRate);
  const belowFloor = sent < RATE_FLOOR;

  // ── The comparison, and the half of it that is not on the wire ───────────
  //
  // /api/analytics/overview computes `priorConversionRate` honestly — it is
  // null when last month had no sent quotes at all, so "up from 0%" off no
  // activity can never appear. What it does NOT send is last month's
  // DENOMINATOR, so this side cannot apply the floor to the prior the way it
  // applies it to the current month. The delta is therefore gated on the
  // CURRENT sample clearing the floor and on the prior existing, and that is
  // the most this payload supports. Sending `quotesSentLastMonth` alongside
  // it would let the prior be floored too; lib/analytics/overview.js already
  // computes that count and simply does not return it.
  const delta =
    belowFloor || rate == null
      ? null
      : compare(rate, overview.priorConversionRate ?? null);

  return {
    id: "conversion",
    known: true,
    floor: RATE_FLOOR,
    belowFloor,
    // No percentage below the floor. The counts carry the whole statement.
    percent: belowFloor || rate == null ? null : Math.round(rate * 100),
    accepted,
    sent,
    delta,
  };
}

/**
 * The whole top of the dashboard, decided.
 *
 * @param {object|null} overview      GET /api/analytics/overview body, or null
 *                                    when refused / failed / not yet answered
 * @param {object|null} money         GET /api/analytics/receivables body, same
 * @param {number|null} upcomingCount visits ahead, or null when not known
 */
export function buildDashboardRank({
  overview = null,
  money = null,
  upcomingCount = null,
} = {}) {
  const receivables = money?.receivables || null;
  const overdue = overdueInvoices(money);

  const needsToday = {
    // null (refused / not answered) and [] (the server said none) are held
    // apart all the way to the renderer: one is "we cannot say", the other is
    // "nothing is late", and only the second is a statement.
    known: Array.isArray(overdue),
    rows: overdue || [],
    // Everything past the first few is a link, not a row.
    moreCount: Array.isArray(receivables?.invoices)
      ? Math.max(
          0,
          receivables.invoices.filter((r) => r.dueState === "overdue").length -
            (overdue?.length || 0),
        )
      : 0,
    total: num(receivables?.overdueTotal),
    currency: money?.currency ?? null,
    canRemind: Boolean(money?.canRemind),
  };

  const hero = {
    known: Boolean(overview),
    // Invoices marked paid this month — /api/analytics/overview's own measure,
    // unchanged. Deliberately NOT the received-money series beside it: the two
    // answer different questions and the page has said so in its own caption
    // since the trend panel was built.
    amount: overview ? (num(overview.revenue) ?? 0) : null,
    // ── The comparison this figure cannot make ────────────────────────────
    //
    // Asked for honestly and answered honestly. compare() returns null when
    // the prior is null, and `overview.priorRevenue` does not exist —
    // lib/analytics/overview.js computes last month's ACCEPTED and SENT quote
    // counts for the conversion comparison, and no prior revenue at all. So
    // there is no delta on the hero, and rather than render a zero or a dash
    // styled as a change, nothing is rendered. Written as a compare() call
    // instead of a literal `null` so that the day the payload carries a prior,
    // the delta appears without anybody having to notice this line.
    delta: overview ? compare(overview.revenue, overview.priorRevenue ?? null) : null,
    currency: money?.currency ?? null,
    // The money that actually LANDED, month by month — a different measure,
    // labelled as one. This is the only revenue series in the codebase, so it
    // is the only thing a sparkline can honestly be drawn from.
    received: money?.revenue?.available ? money.revenue : null,
  };

  const metrics = [
    {
      id: "quotesSent",
      known: Boolean(overview),
      value: overview ? (num(overview.quotesSent) ?? 0) : null,
      // Same shape, same answer, same reason as the hero: the count exists for
      // last month inside lib/analytics/overview.js and is not returned.
      delta: overview ? compare(overview.quotesSent, overview.priorQuotesSent ?? null) : null,
    },
    conversionMetric(overview),
    {
      id: "owed",
      known: Boolean(receivables),
      // receivables.js already draws the three-way split — never billed,
      // everything settled, a real balance — and collapsing it into one $0
      // here would undo that.
      noInvoices: Boolean(receivables?.noInvoices),
      nothingOutstanding: Boolean(receivables?.nothingOutstanding),
      amount: num(receivables?.total),
      count: num(receivables?.count),
      overdueAmount: num(receivables?.overdueTotal),
      overdueCount: num(receivables?.overdueCount),
      currency: money?.currency ?? null,
      // Nothing anywhere computes what was outstanding a month ago, and a
      // balance is a stock rather than a flow — last month's is not recoverable
      // from today's rows. No delta, and none invented.
      delta: null,
    },
    {
      id: "booked",
      known: upcomingCount != null,
      value: upcomingCount == null ? null : (num(upcomingCount) ?? 0),
      // A count of what is ahead, which has no prior period by construction.
      delta: null,
    },
  ];

  return { needsToday, hero, metrics };
}

/**
 * Is there anything for the "Needs you today" block to say?
 *
 * `automationCount` is what NeedsToday's own three lines (a quote the software
 * priced, a call the receptionist took, a slot it booked) add up to. Kept as an
 * argument rather than read here because those come from two other endpoints
 * with their own gates — this file has no opinion about them beyond "are there
 * any".
 *
 * The whole point: with nothing late and nothing waiting, the block is ABSENT.
 * A heading that says work is waiting over an empty list is an accusation
 * nobody earned, and a banner that is present on a quiet day is a banner people
 * stop reading.
 */
export function needsTodayHasWork(rank, automationCount = 0) {
  return (rank?.needsToday?.rows?.length || 0) > 0 || automationCount > 0;
}
