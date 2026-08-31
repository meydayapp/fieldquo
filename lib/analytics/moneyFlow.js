// lib/analytics/moneyFlow.js
//
// Money in, money out, what's left — over a chosen period, with a daily
// series for the chart and a category breakdown for spend. The screen this
// feeds is the one a contractor checks most often, so it gets the plainest
// possible arithmetic: two SUMs and a subtraction, done honestly.
//
// ══ Ported from a good reference, not copied ════════════════════════════════
//
// nextjs-finance-saas-master's app/api/[[...route]]/summary.ts (Drizzle/MySQL,
// single-tenant, one signed `amount` column) is the shape this borrows: one
// grouped query per period with conditional aggregates, a same-length prior
// window for comparison, and a gap-free daily series. FieldQuo has no signed
// ledger — money in and money out live in two different tables, `Payment` and
// `Expense` — so "SUM(CASE WHEN amount >= 0 …)" becomes two separate sums, and
// this file's whole job is making sure those two sums are drawn from the RIGHT
// rows.
//
// ══ Why income is Payment, not Invoice.total ═════════════════════════════════
//
// An invoice can be AMENDED — a new row, same invoiceNumber, a higher
// `version` (lib/export/accountingExport.js's `invoiceFamilies`). Summing
// Invoice.total naively double-counts every amended document, which is exactly
// what invoiceFamilies exists to prevent for receivables. This file sidesteps
// the whole problem instead of solving it a second time: a Payment row is one
// real cash event, recorded against whichever version was current when the
// money arrived, and it is counted once no matter what happens to the
// document afterwards. lib/analytics/receivables.js's revenue trend makes the
// identical argument for the identical reason — see its header. There is
// nothing here that reads Invoice.total, so there is nothing here for an
// amendment to double-count.
//
// ══ Why two booleans are required, not defaulted ════════════════════════════
//
// `everRecordedIncome` / `everRecordedExpense` answer "has this company EVER
// used this feature", across all time — not "is this period's total zero".
// Both are REQUIRED (this file throws rather than assumes either), the same
// refusal buildKpis() makes for `currency`: guessing `true` would print a real
// dollar figure for a company that has never taken a payment through FieldQuo,
// and guessing `false` would permanently hide a real, ordinary $0 month from a
// company with genuine history. Neither guess is this file's to make; the
// route answers it with one cheap existence query per table and hands the
// answer in.
//
// ── The distinction this earns, once the flag is known ──────────────────────
//
// receivables.js already draws this line for AR ("nothingOutstanding" vs
// "noInvoices" — both sum to $0, only one is a statement the file will make)
// and kpis.js repeats it (`receivables.noInvoices ? null : receivables.total`).
// This file draws the same line for income and expenses:
//
//   everRecorded=false  → the figure is UNKNOWN territory for this company,
//                         never rendered as $0 — that would read as "we
//                         checked, you made nothing", when the truth is "you
//                         have never billed a client / logged a cost through
//                         FieldQuo yet".
//   everRecorded=true,
//   this period=0        → a REAL zero. A company with payment history that
//                         happened to take nothing this month gets an honest
//                         $0, the same way receivables' revenue trend draws a
//                         real $0 bar for a quiet month inside an active
//                         series (see its own header).
//
// `remaining` (income − expenses) needs BOTH sides answered to mean anything:
// if either side is unknown territory, `remaining` is too — an unknown minus a
// real number is still unknown, not a number that happens to look precise.
//
// ══ Why the zero-denominator branch is trend.js's, not re-invented ══════════
//
// The reference's calculatePercentageChange() returns 100 when the prior
// period was $0 and the current one is not zero — "up 100%" from nothing,
// which is not a percentage anything can be read as ("up 100% from what?").
// lib/analytics/trend.js's compare() already made the deliberate call for
// this codebase: `deltaPct: null` when the prior is 0 (no percentage can
// honestly express "up from nothing"), `direction: "up"` still stands so the
// arrow/colour is right, and `prior == null` (as opposed to `prior === 0`,
// which is a real value) skips the comparison entirely. Reused here rather
// than re-decided, because a second zero-denominator rule is the one that
// drifts from the first (AGENTS.md failure class 4).
//
// ══ Category breakdown: the trap this deliberately does NOT copy ═══════════
//
// The reference's category query INNER JOINs to `categories` — an Expense row
// with no category simply never appears, and the "top 3 + Other" total is
// quietly short by however much that excluded money was. This file instead
// buckets an empty/whitespace `category` into its own "Uncategorised" slice,
// which competes for a top-3 spot on the same terms as any real category and
// is folded into "Other" exactly like any other small one — so `top + Other`
// always equals the full expense total for the period, and nothing is ever
// dropped without being named.
//
// ══ Pure ═════════════════════════════════════════════════════════════════
//
// No `@/lib/db` import. Every row — Payment, Expense, JobMaterial — arrives
// already fetched and scoped to the company by the route
// (app/api/analytics/money-flow/route.js), the same split
// lib/analytics/kpis.js keeps between "what the DB holds" and "what the
// numbers mean". scripts/check-money-flow.mjs executes this file directly
// against scripted fixtures, including hostile ones, with no database at all.
import { dayKey } from "@/lib/export/accountingExport";
import { compare } from "@/lib/analytics/trend";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const TOP_CATEGORY_COUNT = 3;
const UNCATEGORISED_LABEL = "Uncategorised";

// Same defensive conversion lib/analytics/kpis.js and lib/analytics/burnRate.js
// each keep their own small copy of: a Prisma Decimal arrives with a
// `.toNumber()`, a JSON round-trip turns it into a string. Not imported from
// either — both of those copies are private to their own file, and a third
// tiny local copy is cheaper than exporting one of theirs and coupling this
// pure module to it.
const num = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "object" && typeof v.toNumber === "function" ? v.toNumber() : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => {
  const r = Math.round(num(v) * 100) / 100;
  return Number.isFinite(r) ? r : 0;
};

function badRange(from, to) {
  if (!DAY_RE.test(from || "") || !DAY_RE.test(to || "")) {
    const err = new Error("Give a start and end date as from=YYYY-MM-DD&to=YYYY-MM-DD.");
    err.status = 400;
    return err;
  }
  if (from > to) {
    const err = new Error(`The period runs backwards (${from} to ${to}).`);
    err.status = 400;
    return err;
  }
  return null;
}

/**
 * The same-length window immediately preceding [from, to], inclusive both
 * ends — mirrors the reference's `subDays(startDate, periodLength)` /
 * `subDays(endDate, periodLength)`. A 30-day period is compared to the 30
 * days immediately before it: "how did we do this month" means "compared to
 * last month", not "compared to the same days a year ago".
 *
 * @returns {{from: string, to: string}}
 */
export function priorWindow(from, to) {
  const err = badRange(from, to);
  if (err) throw err;
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  const periodDays = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const priorEnd = new Date(start.getTime() - DAY_MS);
  const priorStart = new Date(priorEnd.getTime() - (periodDays - 1) * DAY_MS);
  return { from: dayKey(priorStart), to: dayKey(priorEnd) };
}

/** Every UTC calendar day in [fromKey, toKey], inclusive, as YYYY-MM-DD. */
function eachDayUTC(fromKey, toKey) {
  const days = [];
  let cur = new Date(`${fromKey}T00:00:00.000Z`).getTime();
  const end = new Date(`${toKey}T00:00:00.000Z`).getTime();
  while (cur <= end) {
    days.push(dayKey(new Date(cur)));
    cur += DAY_MS;
  }
  return days;
}

function sumAmount(rows) {
  return round2((rows || []).reduce((s, r) => s + num(r?.amount), 0));
}

function sumByDay(rows) {
  const map = new Map();
  for (const r of rows || []) {
    const k = dayKey(r?.date);
    if (!k) continue; // an unparseable date can't be placed on a day — dropped, not guessed
    map.set(k, (map.get(k) || 0) + num(r?.amount));
  }
  return map;
}

/**
 * Expense rows, grouped by category, top N by amount with the remainder
 * folded into "Other" — see the header for why an empty category becomes its
 * own named slice instead of vanishing.
 *
 * `top` plus the "Other" row (when present) always sums to the full total —
 * that identity is what scripts/check-money-flow.mjs asserts, so a category
 * this file quietly drops shows up as a failing check rather than a shorted
 * total nobody notices.
 */
export function categoryBreakdown(expenses = [], { topCount = TOP_CATEGORY_COUNT } = {}) {
  const byCategory = new Map();
  for (const e of expenses || []) {
    const raw = typeof e?.category === "string" ? e.category.trim() : "";
    const name = raw || UNCATEGORISED_LABEL;
    byCategory.set(name, (byCategory.get(name) || 0) + num(e?.amount));
  }
  const rows = [...byCategory.entries()]
    .map(([name, value]) => ({ name, value: round2(value) }))
    .filter((r) => r.value !== 0)
    .sort((a, b) => b.value - a.value);

  const top = rows.slice(0, topCount);
  const rest = rows.slice(topCount);
  if (rest.length > 0) {
    top.push({
      name: "Other",
      value: round2(rest.reduce((s, r) => s + r.value, 0)),
      // Named, not hidden — a screen that wants to say what's inside "Other"
      // can, without this file needing a second shape for it.
      collapsed: rest.map((r) => r.name),
    });
  }
  return top;
}

/** English reasons for a null figure, closed vocabulary — kpis.js's REASONS pattern. */
export const REASONS = {
  no_payments_recorded: "No payment has ever been recorded for this company.",
  no_expenses_recorded: "No expense has ever been recorded for this company.",
  no_activity_recorded: "Nothing has been recorded yet — no payments and no expenses.",
};

function figure({ value, available, reason = null, incomplete = false }) {
  return {
    value: available ? value : null,
    available,
    reason: available ? null : reason,
    reasonText: !available && reason ? REASONS[reason] || reason : null,
    incomplete,
  };
}

/**
 * The whole money-flow report for one period.
 *
 * @param {object}   p
 * @param {string}   p.from                YYYY-MM-DD, inclusive
 * @param {string}   p.to                  YYYY-MM-DD, inclusive
 * @param {object[]} [p.payments]          Payment rows in [from,to]: {amount, date}
 * @param {object[]} [p.expenses]          Expense rows in [from,to]: {amount, date, category, projectId}
 * @param {object[]} [p.priorPayments]     Payment rows in the preceding window (see priorWindow)
 * @param {object[]} [p.priorExpenses]     Expense rows in the preceding window
 * @param {boolean}  p.everRecordedIncome  has this company EVER received a payment, at any date? REQUIRED.
 * @param {boolean}  p.everRecordedExpense has this company EVER logged an expense, at any date? REQUIRED.
 * @param {object|null} [p.materialsTrap]  detectMaterialsBuyListTrap()'s result for THIS period — reused
 *                                          from lib/analytics/kpis.js, not rebuilt. Null when the caller
 *                                          didn't compute one (the trap simply isn't reported).
 */
export function buildMoneyFlow({
  from,
  to,
  payments = [],
  expenses = [],
  priorPayments = [],
  priorExpenses = [],
  everRecordedIncome = null,
  everRecordedExpense = null,
  materialsTrap = null,
} = {}) {
  const rangeErr = badRange(from, to);
  if (rangeErr) throw rangeErr;

  if (typeof everRecordedIncome !== "boolean" || typeof everRecordedExpense !== "boolean") {
    // Never defaulted — see the header. A caller that hasn't answered this
    // cannot be answered FOR by this file, the same refusal buildKpis() makes
    // for a missing currency.
    const err = new Error(
      "buildMoneyFlow needs everRecordedIncome and everRecordedExpense as booleans; it will not assume either.",
    );
    err.status = 500;
    throw err;
  }

  const incomeTotal = sumAmount(payments);
  const expenseTotal = sumAmount(expenses);
  const priorIncomeTotal = sumAmount(priorPayments);
  const priorExpenseTotal = sumAmount(priorExpenses);

  const materialsIncomplete = Boolean(materialsTrap?.triggered);

  const income = figure({
    value: incomeTotal,
    available: everRecordedIncome,
    reason: "no_payments_recorded",
  });
  const expensesFigure = figure({
    value: expenseTotal,
    available: everRecordedExpense,
    reason: "no_expenses_recorded",
    // Unlike kpis.js's margin figures, this is not SUPPRESSED when the
    // materials trap fires: it is a plain sum of the Expense rows that
    // genuinely exist, and that sum is correct as far as it goes. The trap
    // means real spending is missing from it, not that the sum itself is
    // wrong — so it stays visible and flagged, the way kpis.js flags
    // `incomplete` on figures built from approved-hours-only labour cost,
    // rather than suppressed the way its margin percentages are (a ratio
    // built on a known-short denominator is a wrong number; a sum of what
    // was actually logged is a right number about a partial picture).
    incomplete: materialsIncomplete,
  });
  const bothKnown = everRecordedIncome && everRecordedExpense;
  const remaining = figure({
    value: round2(incomeTotal - expenseTotal),
    available: bothKnown,
    reason: !everRecordedIncome && !everRecordedExpense
      ? "no_activity_recorded"
      : !everRecordedIncome
        ? "no_payments_recorded"
        : "no_expenses_recorded",
    incomplete: materialsIncomplete,
  });

  // A percentage change with no honest prior reading shows nothing — see the
  // header on trend.js reuse. `current === null` (the figure itself is
  // unknown territory) short-circuits before compare() is even called, so an
  // absent figure can never grow a trend arrow of its own.
  const trends = {
    income: income.available ? compare(incomeTotal, priorIncomeTotal) : null,
    expenses: expensesFigure.available ? compare(expenseTotal, priorExpenseTotal) : null,
    remaining: remaining.available
      ? compare(remaining.value, round2(priorIncomeTotal - priorExpenseTotal))
      : null,
  };

  // ── The daily series ────────────────────────────────────────────────────
  //
  // Gap-free by construction — every UTC day in the range gets an entry, the
  // reference's fillMissingDays() behaviour, so a chart never has to guess
  // what a missing point means. A day's figure is null (not 0) on whichever
  // side has no history at all — the same everRecorded distinction as the
  // headline tiles, so a chart can't flatline a company's income at $0/day
  // when the truth is "this company has never been paid through FieldQuo".
  const incomeByDay = everRecordedIncome ? sumByDay(payments) : null;
  const expenseByDay = everRecordedExpense ? sumByDay(expenses) : null;
  const days = eachDayUTC(from, to).map((date) => ({
    date,
    income: incomeByDay ? round2(incomeByDay.get(date) || 0) : null,
    expenses: expenseByDay ? round2(expenseByDay.get(date) || 0) : null,
  }));

  const categories = everRecordedExpense ? categoryBreakdown(expenses) : [];

  return {
    range: { from, to },
    priorRange: priorWindow(from, to),
    income,
    expenses: expensesFigure,
    remaining,
    trends,
    days,
    // The chart itself: absent only when NEITHER side has ever been recorded
    // — a company with real history on at least one side still gets a chart,
    // with the unrecorded side simply not drawn (see the page).
    chartAvailable: everRecordedIncome || everRecordedExpense,
    categories,
    categoriesTotal: round2(categories.reduce((s, c) => s + c.value, 0)),
    materialsTrap: materialsTrap || null,
  };
}
