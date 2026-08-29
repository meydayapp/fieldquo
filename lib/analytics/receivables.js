// lib/analytics/receivables.js
//
// Two questions the dashboard could not answer: WHO owes me, and for HOW LONG;
// and what has the money coming in actually been doing.
//
// ══ Not a second definition of "what I am owed" ═════════════════════════════
//
// lib/accounting/statements.js already computes receivables for the balance
// sheet: one row per invoice FAMILY at the latest version, drafts and cancelled
// documents excluded, less every payment dated on or before the statement date.
// Two answers to "how much am I owed" that differ by a dollar is worse than
// one, so this file does not restate that rule — it reuses the same primitives
// (`invoiceFamilies`, `dayKey`) and applies the same predicate, and
// scripts/check-dashboard.mjs EXECUTES both against one dataset and asserts the
// totals reconcile exactly. If they ever stop agreeing, that check fails.
//
// The one deliberate difference, and it is a presentation split rather than a
// second definition: an OVERPAID document (payments exceed the latest total) is
// netted into the balance-sheet figure — a balance sheet must net — and is
// listed separately here, because "-$180 owed" on a chase card is not a
// sentence anybody can act on. `total - creditsTotal` is the statements figure,
// and that identity is what the check asserts.
//
// ── An invoice marked paid with no payment recorded still shows as owed ─────
//
// Status is not consulted beyond draft/cancelled, exactly as statements does
// it, and that is also lib/invoices/lifecycle.js's rule: `settled` there is
// decided by money, not by the status column. So the three surfaces — the
// invoice page's balance, the balance sheet, and this panel — agree by
// construction. Someone who flips the status to paid without recording the
// payment is told the same thing on all three.
//
// ══ Two date conventions, both borrowed, neither invented ═══════════════════
//
// Whether a document is receivable AT ALL uses `dayKey` (UTC calendar day) —
// statements' rule, so the sets match.
//
// How LATE it is uses `calendarDaysBetween` from lib/invoices/lifecycle.js —
// local calendar days, because that is what the invoice page's own "Overdue by
// 12 days" banner says, and a contractor comparing the dashboard card to the
// invoice it names must not read two different numbers. A third rule here
// would be the actual mistake.
//
// ══ Absence is never a zero ════════════════════════════════════════════════
//
// AGENTS.md failure class 5, and the reason this file returns flags rather than
// numbers alone:
//
//   nothingOutstanding   every invoice is settled. A fact, worth saying, and
//                        NOT the same screen as "$0.00 owed" over a chart.
//   noInvoices           there are no invoices at all. Nothing has been billed,
//                        so there is nothing to be owed and no aging to show.
//   undated              an invoice with no dueDate is NOT overdue. It has no
//                        due date, which is a different statement and is the
//                        one that gets rendered. It never lands in an aging
//                        bucket and never contributes a day count.
//   notPlaced            an invoice with neither sentAt nor createdAt cannot be
//                        placed in time. Counted and named, never silently
//                        dropped — the same thing statements warns about.
//
// Pure. No `@/lib/db`, no route, no React: every row is passed in, so the check
// script can execute the arithmetic against a scripted dataset rather than read
// it.
import { dayKey, invoiceFamilies } from "@/lib/export/accountingExport";
import { calendarDaysBetween, PAID_EPSILON } from "@/lib/invoices/lifecycle";
import { compare } from "@/lib/analytics/trend";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Round to cents, finite-safe in both directions — same guard as statements. */
const round2 = (v) => {
  const r = Math.round(num(v) * 100) / 100;
  return Number.isFinite(r) ? r : 0;
};

/**
 * The aging ladder, as ids rather than English.
 *
 * `not_due` is first because it is not a late bucket at all: an invoice sent
 * with 30-day terms on Monday is not a problem, and colouring it beside a
 * 90-day debt would make the panel meaningless. `undated` is deliberately NOT
 * on this ladder — see the header.
 *
 * Bounds are inclusive on both ends, in whole calendar days past the due date.
 */
export const AGING_BUCKETS = [
  { id: "not_due", from: null, to: 0, overdue: false },
  { id: "days_1_30", from: 1, to: 30, overdue: true },
  { id: "days_31_60", from: 31, to: 60, overdue: true },
  { id: "days_61_90", from: 61, to: 90, overdue: true },
  { id: "days_90_plus", from: 91, to: null, overdue: true },
];

/** Which bucket a day-count falls in. `null` days → null bucket, never a guess. */
export function agingBucket(daysPastDue) {
  if (daysPastDue === null || daysPastDue === undefined) return null;
  const d = Number(daysPastDue);
  if (!Number.isFinite(d)) return null;
  for (const b of AGING_BUCKETS) {
    if (b.from !== null && d < b.from) continue;
    if (b.to !== null && d > b.to) continue;
    return b.id;
  }
  return null;
}

/** The issue date of a family, and which column it came from. statements' rule. */
function issueOf(family) {
  const source = family.root || family.members[0];
  const sent = dayKey(source?.sentAt);
  if (sent) return { key: sent, from: "sentAt" };
  const created = dayKey(source?.createdAt);
  if (created) return { key: created, from: "createdAt" };
  return { key: null, from: null };
}

/**
 * What is still owed, per document, with age.
 *
 * @param {object}   p
 * @param {object[]} p.invoices  Invoice rows — EVERY version, or families break
 * @param {object[]} p.payments  Payment rows ({ invoiceId, amount, date })
 * @param {Date}     p.asOf      "now", injected so the check can pin it
 * @returns {{
 *   asOf: string, total: number, count: number, invoices: object[],
 *   aging: object[], overdueTotal: number, overdueCount: number,
 *   undatedTotal: number, undatedCount: number,
 *   creditsTotal: number, credits: object[],
 *   nothingOutstanding: boolean, noInvoices: boolean, notPlaced: number,
 * }}
 *
 * Every invoice card carries the LATEST version's id, because that is the row
 * POST /api/invoices/[id]/request-payment must be pointed at — chasing a
 * superseded version emails a document that has been replaced.
 */
export function buildReceivables({ invoices = [], payments = [], asOf = new Date() } = {}) {
  const asAt = dayKey(asOf);
  if (!asAt) throw new Error("buildReceivables needs a valid `asOf` date.");

  const families = invoiceFamilies(invoices);

  // Payments indexed by the row they were recorded against, once. A per-family
  // `payments.filter(...)` inside the loop is O(families × payments), which on
  // a decade of history is the difference between a dashboard and a timeout.
  const paidByRow = new Map();
  let paymentsNotPlaced = 0;
  for (const p of payments) {
    if (!p?.invoiceId) continue;
    const key = dayKey(p.date);
    // A payment with no usable date cannot be placed on or before `asAt`.
    // Treating it as received would overstate what has come in; dropping it
    // silently overstates what is owed. It is dropped AND counted, so the
    // panel can say a figure is short rather than look complete.
    if (key === null) {
      paymentsNotPlaced += 1;
      continue;
    }
    if (key > asAt) continue;
    paidByRow.set(p.invoiceId, (paidByRow.get(p.invoiceId) || 0) + num(p.amount));
  }

  const owed = [];
  const credits = [];
  let notPlaced = 0;

  for (const family of families) {
    const latest = family.latest;
    // Drafts and cancelled documents are not receivable: a draft is the office
    // still deciding the figure, and nobody has been asked for it.
    if (latest?.status === "draft" || latest?.status === "cancelled") continue;

    const issue = issueOf(family);
    if (!issue.key) {
      notPlaced += 1;
      continue;
    }
    if (issue.key > asAt) continue;

    // Family-wide, because an amendment leaves the payment on the version it
    // was recorded against. Summing only the latest row would report a
    // part-paid invoice as owed in full the moment somebody amends it.
    const paid = family.members.reduce((s, m) => s + (paidByRow.get(m.id) || 0), 0);
    const total = num(latest?.total);
    const outstanding = round2(total - paid);

    if (Math.abs(outstanding) <= PAID_EPSILON) continue;

    // ── An invoice with no due date is not overdue, it is undated ───────────
    //
    // Counting from creation would manufacture a debt age nobody agreed to:
    // "45 days past due" on an invoice that never carried a due date is a
    // number the contractor cannot defend if the client asks where it came
    // from. null days, no bucket, its own sentence.
    //
    // A due date that will not parse lands here too: calendarDaysBetween
    // returns null, and an unreadable date is exactly as much of a deadline as
    // no date at all.
    const rawDue = latest?.dueDate || null;
    const days = rawDue ? calendarDaysBetween(rawDue, asOf) : null;
    const dueDate = days === null ? null : rawDue;
    const daysPastDue = days;

    const card = {
      // The row to chase. See the note above.
      id: latest?.id ?? family.rootId,
      rootId: family.rootId,
      invoiceNumber: latest?.invoiceNumber ?? null,
      clientId: latest?.clientId ?? null,
      // The route replaces this with a redacted copy; the module keeps it
      // whole because it has no opinion about who is looking.
      client: latest?.client ?? null,
      status: latest?.status ?? null,
      total: round2(total),
      paid: round2(paid),
      owed: outstanding,
      // A part-paid document is receivable for the REMAINDER, and says so
      // rather than showing its face value.
      partiallyPaid: paid > PAID_EPSILON,
      dueDate,
      daysPastDue: daysPastDue !== null && daysPastDue > 0 ? daysPastDue : null,
      dueState: !dueDate ? "undated" : daysPastDue > 0 ? "overdue" : "not_due",
      bucket: dueDate ? agingBucket(daysPastDue) : null,
      issuedOn: issue.key,
      issuedFrom: issue.from,
      // An amended document. Worth showing: the figure on this card is the
      // latest version's, which is not the one the client was first sent.
      version: Number(latest?.version) || 1,
      amended: family.versionCount > 1,
    };

    if (outstanding > 0) owed.push(card);
    else credits.push({ ...card, owed: outstanding });
  }

  // Oldest debt first — the order a contractor works the list in. Undated last:
  // they are not late, so they do not belong at the top of a chase list.
  owed.sort((a, b) => {
    const ad = a.daysPastDue ?? -Infinity;
    const bd = b.daysPastDue ?? -Infinity;
    if (ad !== bd) return bd - ad;
    return b.owed - a.owed;
  });

  const aging = AGING_BUCKETS.map((b) => {
    const rows = owed.filter((r) => r.bucket === b.id);
    return {
      id: b.id,
      overdue: b.overdue,
      count: rows.length,
      amount: round2(rows.reduce((s, r) => s + r.owed, 0)),
    };
  });

  const undated = owed.filter((r) => r.dueState === "undated");
  const overdue = owed.filter((r) => r.dueState === "overdue");

  return {
    asOf: asAt,
    total: round2(owed.reduce((s, r) => s + r.owed, 0)),
    count: owed.length,
    invoices: owed,
    aging,
    overdueTotal: round2(overdue.reduce((s, r) => s + r.owed, 0)),
    overdueCount: overdue.length,
    undatedTotal: round2(undated.reduce((s, r) => s + r.owed, 0)),
    undatedCount: undated.length,
    // Held apart from `total` on purpose — see the header.
    credits,
    creditsTotal: round2(credits.reduce((s, r) => s + r.owed, 0)),
    // The two absences, which the screen renders as sentences and not as 0.
    noInvoices: families.length === 0,
    nothingOutstanding: families.length > 0 && owed.length === 0,
    notPlaced,
    paymentsNotPlaced,
  };
}

// ── The revenue trend ──────────────────────────────────────────────────────
//
// ══ What "revenue" means here, stated because it has to be ═════════════════
//
// Money RECEIVED — one Payment row, one real event — grouped by the month it
// landed in. That is lib/accounting/statements.js's CASH basis, which is the
// basis most owner-operators file on and the one every figure can be traced
// back to a row for.
//
// It is deliberately NOT the "Revenue this month" tile's measure, which sums
// the totals of invoices whose status is `paid`. Those two are different
// questions and this panel says which one it is answering in its own caption,
// because a chart that quietly disagreed with the tile beside it would be worse
// than either. Grouping by payment also makes the amended-invoice trap
// impossible here: a payment belongs to one row and is counted once whatever
// happens to the document afterwards.

/** The period lengths the selector offers, in months. */
export const TREND_PERIODS = [3, 6, 12];

/** "2026-08" for a Date, on dayKey's UTC calendar. */
const monthKey = (value) => {
  const k = dayKey(value);
  return k ? k.slice(0, 7) : null;
};

/** Step a UTC month key back/forward by n months. */
function shiftMonth(key, n) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Money received, by month, with a plainly-stated change.
 *
 * @param {object}   p
 * @param {object[]} p.payments      Payment rows; anything outside the window
 *                                   is ignored rather than clamped into it
 * @param {number}   p.months        one of TREND_PERIODS
 * @param {boolean}  p.everRecorded  has this company EVER recorded a payment?
 *                                   The window alone cannot tell "no money came
 *                                   in during these six months" (a fact) from
 *                                   "this company has never taken a payment"
 *                                   (an absence), and they are different
 *                                   screens. The caller, which can see the
 *                                   whole table, answers it.
 * @param {Date}     p.asOf
 * @returns {{available: boolean, reason: string|null, months: number,
 *            series: object[], headline: object|null, total: number}}
 *
 * `headline` compares the last COMPLETE month with the one before it, and is
 * null when there are not two complete months in the window. Comparing a month
 * that is four days old against a finished one would manufacture a collapse
 * every month, which is exactly the kind of confident wrong number that makes a
 * panel unbelievable.
 */
export function buildRevenueTrend({
  payments = [],
  months = 6,
  everRecorded = null,
  asOf = new Date(),
} = {}) {
  const span = TREND_PERIODS.includes(Number(months)) ? Number(months) : 6;
  const currentMonth = monthKey(asOf);
  if (!currentMonth) throw new Error("buildRevenueTrend needs a valid `asOf` date.");

  // Nothing has ever been received. Not a run of zero months — a company that
  // has not been paid yet, which is a sentence, not a flat line at the axis.
  if (everRecorded === false) {
    return {
      available: false,
      reason: "no_payments_recorded",
      months: span,
      series: [],
      headline: null,
      total: 0,
    };
  }

  const keys = [];
  for (let i = span - 1; i >= 0; i--) keys.push(shiftMonth(currentMonth, -i));

  const buckets = new Map(keys.map((k) => [k, { amount: 0, count: 0 }]));
  for (const p of payments) {
    const k = monthKey(p?.date);
    if (!k) continue;
    const slot = buckets.get(k);
    if (!slot) continue;
    slot.amount += num(p?.amount);
    slot.count += 1;
  }

  const series = keys.map((k) => ({
    month: k,
    amount: round2(buckets.get(k).amount),
    count: buckets.get(k).count,
    // The month we are standing in is not finished, and a bar for it is not
    // comparable to the ones beside it. Flagged so the chart can say so.
    partial: k === currentMonth,
  }));

  const complete = series.filter((s) => !s.partial);
  let headline = null;
  if (complete.length >= 2) {
    const latest = complete[complete.length - 1];
    const prior = complete[complete.length - 2];
    // compare() returns null when no honest comparison exists, and a null
    // deltaPct when the prior month was zero — "up from nothing" has no
    // percentage, and printing ∞% or 100% would be inventing one.
    const t = compare(latest.amount, prior.amount);
    if (t) {
      headline = {
        month: latest.month,
        priorMonth: prior.month,
        amount: latest.amount,
        prior: prior.amount,
        direction: t.direction,
        deltaAbs: round2(t.deltaAbs),
        deltaPct: t.deltaPct === null ? null : Math.round(Math.abs(t.deltaPct) * 100),
      };
    }
  }

  return {
    available: true,
    reason: null,
    months: span,
    series,
    headline,
    total: round2(series.reduce((s, r) => s + r.amount, 0)),
  };
}
